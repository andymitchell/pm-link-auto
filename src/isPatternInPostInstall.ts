// src/project-utils.ts

import { findUp } from 'find-up';
import { promises as fs } from 'fs';

/**
 * A partial interface for the package.json file.
 * We only define the fields we are interested in for type safety.
 */
interface PackageJson {
    scripts?: Record<string, string> & {
        postinstall?: string;
    };
}

/**
 * Finds the consuming project's package.json and checks if its `postinstall`
 * script contains a specific string or pattern.
 *
 * This function is designed to be called from within a dependency (your npm library)
 * to inspect the host project's configuration.
 *
 * @param searchPattern The string or RegExp to search for in the postinstall script.
 * @returns A Promise that resolves to `true` if the pattern is found, otherwise `false`.
 */
export async function isPatternInPostinstall(
    searchPattern: string | RegExp
): Promise<boolean> {
    try {
        // 1. Find the path to the closest package.json, searching upwards
        const packageJsonPath = await findUp('package.json');

        // If no package.json is found (highly unlikely in a real project)
        if (!packageJsonPath) {
            console.warn('Could not find a package.json file.');
            return false;
        }

        // 2. Read the package.json file content
        const fileContent = await fs.readFile(packageJsonPath, 'utf-8');
        const packageJson: PackageJson = JSON.parse(fileContent);

        // 3. Safely access the postinstall script using optional chaining
        const postinstallScript = packageJson.scripts?.postinstall;

        // If scripts.postinstall does not exist, the pattern can't be there
        if (!postinstallScript) {
            return false;
        }

        // 4. Check if the pattern exists in the script string
        if (typeof searchPattern === 'string') {
            return postinstallScript.includes(searchPattern);
        } else {
            // If it's a RegExp, use test()
            return searchPattern.test(postinstallScript);
        }
    } catch (error) {
        // Handle potential errors like file read issues or invalid JSON
        console.error('An error occurred while checking the postinstall script:', error);
        return false;
    }
}