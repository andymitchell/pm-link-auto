import path from 'node:path';
import os from 'node:os';
import chalk from 'chalk';
import prompts from 'prompts';
import { glob } from 'glob';
import { getPackageNameFromPath, runCommand, getLinkCommands } from './utils.ts';
import { MODULE_NAME, updateConfigFile } from './config.ts';
import type { LinkerConfig, PackageEntry, ValidatedPackageEntry, PackageManager } from './types.ts';
import { getNpmLinkList } from './getNpmLinkList.ts';

/** Searches for a package by name within a root directory. */
async function findPackagesInSearchRoot(packageNames: string[], searchRoot: string): Promise<Record<string, string>> {
    console.log(chalk.cyan(`\nSearching for all packages in '${searchRoot}'...`));
    const startTime = Date.now();
    const packageJsonFiles = await glob('**/package.json', {
        cwd: searchRoot,
        ignore: '**/node_modules/**',
        absolute: true,
    });


    const duration = (Date.now() - startTime) / 1000;

    console.log(chalk.dim(`  Search complete. Found ${packageJsonFiles.length} package.json files in ${duration.toFixed(2)}s. Now checking names...`));

    const nameToPathMap:Record<string, string> = {};

    for (const file of packageJsonFiles) {
        const dir = path.dirname(file);
        const foundName = getPackageNameFromPath(dir);
        if( foundName && packageNames.includes(foundName) ) {
            nameToPathMap[foundName] = dir;
        }
    }

    const foundNames = new Set(Object.keys(nameToPathMap));
    const missingNames = packageNames.filter(x => !foundNames.has(x));
    if( missingNames.length===0 ) {
        const prettyPackages = Object.keys(nameToPathMap).map((name) => `- ${name}: ${nameToPathMap[name]}`).join("\n");
        console.log(chalk.green(`  ✓ Found all packages:\n${prettyPackages}`));
    } else {
        console.error(chalk.red(`Failed to find some packages: `), missingNames);
        process.exit(1);
    }

    return nameToPathMap;
}


/**
 * Lists all globally linked packages and their source paths for a given package manager.
 * @returns A Map of package names to their fully resolved, absolute linked file system paths.
 */
async function getGlobalLinkedPackages(pm: PackageManager): Promise<Map<string, string>> {
    let linkedPackages = new Map<string, string>();
    try {
        if (pm === 'pnpm') {
            // pnpm's --long --json output is already absolute and correct. No changes needed here.
            const listCommand = 'pnpm list -g --depth=0 --long --json';
            const { stdout } = await runCommand(listCommand);

            if (!stdout.trim()) {
                return linkedPackages;
            }

            const pnpmList = JSON.parse(stdout);
            if (Array.isArray(pnpmList)) {
                for (const pkg of pnpmList) {
                    if (pkg.name && pkg.path) {
                        linkedPackages.set(pkg.name, pkg.path);
                    }
                }
            }
        } else { // Handles npm and yarn
            linkedPackages = await getNpmLinkList(pm);
            
        }
        return linkedPackages;
    } catch (e) {
        console.warn(chalk.yellow('Could not list global packages. Will attempt to link all anyway.'));
        if (e instanceof Error) {
            console.warn(chalk.dim(`  Reason: ${e.message}`));
        }
        return new Map();
    }
}


export async function runLinker(config: LinkerConfig, configPath: string, pm: PackageManager) {
    const { packages: packagesToLink, packageSearchRoot } = config;

    if (!packagesToLink || packagesToLink.length === 0) {
        console.log(chalk.yellow('No packages configured to link. Nothing to do.'));
        return;
    }

    const searchRoot = (packageSearchRoot || '~/').replace('~', os.homedir());

    // 1. Validate paths and identify entries needing discovery
    console.log(chalk.bold.underline('\nValidating package paths...'));
    const validEntries: ValidatedPackageEntry[] = [];
    const invalidEntries: PackageEntry[] = [];

    for (const entry of packagesToLink) {
        if (entry.path) {
            const absolutePath = path.resolve(path.dirname(configPath), entry.path);
            const foundPackageName = getPackageNameFromPath(absolutePath);
            if (foundPackageName && foundPackageName === entry.name) {
                console.log(chalk.green(`  ✓ Valid:   '${entry.name}' at ${entry.path}`));
                validEntries.push({ ...entry, path: absolutePath });
            } else {
                console.log(chalk.red(`  ✗ Invalid: '${entry.name}' path is incorrect or missing package.json.`));
                invalidEntries.push(entry);
            }
        } else {
            console.log(chalk.yellow(`  ? Missing: '${entry.name}' path is not defined.`));
            invalidEntries.push(entry);
        }
    }

    let resolvedEntries = [...validEntries];

    // 2. Auto-discover missing/invalid paths if user consents
    if (invalidEntries.length > 0) {
        const { shouldDiscover } = await prompts({
            type: 'confirm',
            name: 'shouldDiscover',
            message: `Found ${invalidEntries.length} package(s) with missing or invalid paths. Do you want to try and auto-discover them in '${searchRoot}'?`,
            initial: true,
        });

        if (shouldDiscover) {
            const startTime = Date.now();
            const foundPaths = await findPackagesInSearchRoot(invalidEntries.map(x => x.name), searchRoot);
            const duration = (Date.now() - startTime) / 1000;

            console.log(chalk.dim(`  Packages found in ${duration.toFixed(2)}s. Now updating config...`));

            for( const name in foundPaths ) {
                const foundPath = foundPaths[name]!;
                await updateConfigFile(configPath, name, foundPath);
                resolvedEntries.push({ name, path: foundPath });
            }

            console.log(chalk.yellow(`\nAuto-discovery successful. Now please check the paths in ${MODULE_NAME}.config.(t|j)s and rerun. Exiting.`));
            return;
            
        }
    }

    if (resolvedEntries.length === 0) {
        console.log(chalk.yellow('\nNo valid packages to link. Exiting.'));
        return;
    }

    // 3. Register global links
    console.log(chalk.bold.underline(`\nStep 1: Registering packages with ${pm}...`));
    // NOTE: Assumes `getLinkCommands` now also returns a `globalUnlink` function, e.g.,
    // globalUnlink: (name: string) => `${pm} unlink -g ${name}`
    const linkCommands = getLinkCommands(pm);
    const globallyLinked = await getGlobalLinkedPackages(pm);

    for (const entry of resolvedEntries) {
        const existingPath = globallyLinked.get(entry.name);
        const intendedPath = entry.path;

        if (!existingPath) {
            // Case 1: Package is not linked at all.
            try {
                console.log(chalk.cyan(`  + Linking '${entry.name}' globally...`));
                await runCommand(linkCommands.globalLink, intendedPath);
            } catch (error) {
                console.error(chalk.red(`Failed to globally link ${entry.name}:`), error);
            }
        } else if (path.resolve(existingPath) === path.resolve(intendedPath)) {
            // Case 2: Package is already linked to the correct path.
            console.log(chalk.blue(`  - '${entry.name}' is already linked correctly.`));
        } else {
            // Case 3: Conflict. Package is linked from a different path.
            console.log(chalk.yellow(`  ! Conflict for '${entry.name}':`));
            console.log(chalk.yellow(`    - Currently linked from: ${existingPath}`));
            console.log(chalk.yellow(`    - You want to link from: ${intendedPath}`));

            const { shouldRelink } = await prompts({
                type: 'confirm',
                name: 'shouldRelink',
                message: `Do you want to unlink the existing version and relink from the correct path?`,
                initial: true,
            });

            if (shouldRelink) {
                try {
                    console.log(`  - Unlinking existing '${entry.name}'...`);
                    await runCommand(linkCommands.globalUnlink(entry.name));

                    console.log(`  + Linking new version of '${entry.name}'...`);
                    await runCommand(linkCommands.globalLink, intendedPath);

                    console.log(chalk.green(`  ✓ Successfully relinked '${entry.name}'.`));
                } catch (error) {
                    console.error(chalk.red(`Failed to relink ${entry.name}:`), error);
                }
            } else {
                console.log(chalk.dim(`  Skipping link for '${entry.name}'. It remains linked from the old path.`));
            }
        }
    }

    // 4. Link dependencies to the current project
    console.log(chalk.bold.underline('\nStep 2: Linking packages to this project...'));
    const packagesToLinkNames = resolvedEntries.map(e => e.name);
    try {
        await runCommand(linkCommands.localLink(packagesToLinkNames), process.cwd());
        console.log(chalk.green.bold(`\n  ✓ Successfully linked ${packagesToLinkNames.length} package(s) to this project.`));
    } catch (error) {
        console.error(chalk.red(`Failed to link packages to this project:`), error);
    }

    console.log(chalk.cyan.bold('\nAll done!'));
}