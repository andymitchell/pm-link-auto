import { exec as nodeExec } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import chalk from 'chalk';
import { type PackageManager } from './types.ts';

const execAsync = promisify(nodeExec);

/** A simple promise-based wrapper for child_process.exec */
export async function runCommand(command: string, cwd?: string): Promise<{ stdout: string; stderr: string }> {
    console.log(chalk.dim(`$ ${command}${cwd ? ` (in ${path.relative(process.cwd(), cwd)})` : ''}`));
    return execAsync(command, { cwd });
}

/** Checks if a given path is a valid package directory by reading its package.json. */
export function getPackageNameFromPath(packagePath: string): string | null {
    try {
        const pkgJsonPath = path.join(packagePath, 'package.json');
        if (!fs.existsSync(pkgJsonPath)) return null;
        const pkgJsonContent = fs.readFileSync(pkgJsonPath, 'utf-8');
        const pkgJson = JSON.parse(pkgJsonContent);
        return pkgJson.name || null;
    } catch (error) {
        console.error(chalk.red(`Error reading package.json in ${packagePath}:`), error);
        return null;
    }
}

/** Detects the package manager used in the current project. */
export function detectPackageManager(): PackageManager {
    if (fs.existsSync(path.resolve(process.cwd(), 'pnpm-lock.yaml'))) {
        return 'pnpm';
    }
    if (fs.existsSync(path.resolve(process.cwd(), 'yarn.lock'))) {
        return 'yarn';
    }
    return 'npm';
}

/** Gets the appropriate link commands for the detected package manager. */
export function getLinkCommands(pm: PackageManager) {
    switch (pm) {
        case 'pnpm':
            return {
                globalLink: 'pnpm link --global',
                localLink: (pkgs: string[]) => `pnpm link --global ${pkgs.join(' ')}`,
            };
        case 'yarn':
            return {
                globalLink: 'yarn link',
                localLink: (pkgs: string[]) => `yarn link ${pkgs.join(' ')}`,
            };
        case 'npm':
        default:
            return {
                globalLink: 'npm link',
                localLink: (pkgs: string[]) => `npm link ${pkgs.join(' ')}`,
            };
    }
}