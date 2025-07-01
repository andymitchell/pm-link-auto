import fs from 'node:fs/promises';
import chalk from "chalk";
import { runCommand } from "./utils.ts";
import path from "path";
import type { PackageManager } from './types.ts';

export async function getNpmLinkList(pm:PackageManager): Promise<Map<string, string>> {
    const globalNodeModulesPath = await getGlobalNodeModulesPath(pm);

    const lines = await getNpmListLines();
    
    const map = await parseNpmLinkOutput(lines, globalNodeModulesPath);

    return map;
}

async function getGlobalNodeModulesPath(pm:PackageManager):Promise<string> {
    const { stdout: globalRoot } = await runCommand(`${pm === 'yarn' ? 'yarn global dir' : 'npm root -g'}`);
    const globalNodeModulesPath = pm === 'yarn' ? path.join(globalRoot.trim(), 'node_modules') : globalRoot.trim();
    return globalNodeModulesPath;

}

export async function getNpmListLines(): Promise<string[]> {

    const listCommand = 'npm list -g --depth=0 --link=true';
    const { stdout } = await runCommand(listCommand);
    const lines = stdout.split('\n');

    return lines;

}

export async function parseNpmLinkOutput(lines: string[], globalNodeModulesPath: string): Promise<Map<string, string>> {
    const linkedPackages = new Map<string, string>();

    for (const line of lines) {
        // 1. Gatekeeper: The most reliable signal of a package line is the '->' arrow.
        if (!line.includes('->')) {
            continue; // Not a package link line, skip.
        }

        // 2. Isolate the identifier part (left of the arrow).
        const identifierPart = line.split('->')[0]!;

        // 3. Clean the identifier: Remove tree characters and trim whitespace.
        const cleanIdentifier = identifierPart.replace(/^[└├─\s]+/, '').trim();
        if (!cleanIdentifier) {
            continue; // Skip if it was empty.
        }

        // 4. Extract the name, correctly handling scopes and version strings.
        let name: string;
        if (cleanIdentifier.startsWith('@')) {
            // Scoped package: @scope/name@1.2.3
            const parts = cleanIdentifier.split('@');
            name = parts.length > 2 ? `@${parts[1]}` : cleanIdentifier;
        } else {
            // Regular package: my-package@1.2.3
            name = cleanIdentifier.split('@')[0]!;
        }

        if (!name) {
            continue; // Could not determine a name.
        }

        // 5. Use the extracted name to find the real path of the symlink.
        
        const symlinkPath = path.join(globalNodeModulesPath, name);


        try {
            const realPath = await fs.realpath(symlinkPath);
            linkedPackages.set(name, realPath);
        } catch (err) {
            console.warn(chalk.yellow(`  Could not resolve link for '${name}'. It may be a broken symlink. Skipping.`));
        }
    }

    return linkedPackages;
}