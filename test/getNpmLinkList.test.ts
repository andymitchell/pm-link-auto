
// 1. Mock the 'fs/promises' module. Vitest hoists this to the top.
// We are replacing the entire module with an empty object for now.
// We will provide a specific implementation for `realpath` inside the test.
vi.mock('node:fs/promises');

import { it, describe, expect, vi, type Mock } from "vitest";
import { parseNpmLinkOutput } from "../src/getNpmLinkList.js";
import path from "path";


describe('parseNpmLinkOutput', () => {

    it('should correctly parse npm link output and resolve symlinks', async () => {
        // ARRANGE

        // 2. Import the mocked module *after* the vi.mock call.
        // `fs.realpath` is now a mock function.
        const fs = await import('node:fs/promises');

        const globalNodeModulesPath = "/Users/bob/.nvm/versions/node/v20.15.1/lib/node_modules";

        const npmLinkListLines = [
            '/Users/bobmonkhouse/.nvm/versions/node/v20.15.1/lib',
            '├── @bobrmonkhouse/apichisel@0.0.1 -> ./../../../../../git/api/api-chisel',
            '├── @bobrmonkhouse/pm-link-auto@0.0.1 -> ./../../../../../git/breef/pm-link-auto',
            '├── @bobrmonkhouse/securethis@0.0.4 -> ./../../../../../git/securethis',
            '└── @bobrmonkhouse/store@0.1.0 -> ./../../../../../git/breef/store',
            'BROKEN -> ../../broken/path', // A line with an arrow but no package info
            'just some other random line',
            '', // Empty line
        ];

        // 3. Define the expected results. The keys are the package names,
        // and the values are the "real" paths we want our mock to return.
        const expectedPackages = new Map<string, string>([
            ['@bobrmonkhouse/apichisel', '/Users/bobmonkhouse/git/api/api-chisel'],
            ['@bobrmonkhouse/pm-link-auto', '/Users/bobmonkhouse/git/breef/pm-link-auto'],
            ['@bobrmonkhouse/securethis', '/Users/bobmonkhouse/git/securethis'],
            ['@bobrmonkhouse/store', '/Users/bobmonkhouse/git/breef/store'],
        ]);

        // 4. Configure the mock's behavior.
        // Create a map where the KEY is the *exact, full symlink path* that our code
        // will try to resolve, and the VALUE is the fake real path to return.
        // This avoids any brittle parsing logic within the mock itself.
        const symlinkToRealPathMap = new Map<string, string>();
        for (const [packageName, realPath] of expectedPackages.entries()) {
            const fullSymlinkPath = path.join(globalNodeModulesPath, packageName);
            symlinkToRealPathMap.set(fullSymlinkPath, realPath);
        }

        // Configure the mock's behavior using our new map.
        (fs.realpath as Mock).mockImplementation(async (pathToResolve: string) => {
            if (symlinkToRealPathMap.has(pathToResolve)) {
                return Promise.resolve(symlinkToRealPathMap.get(pathToResolve));
            }
            // If the code passes a path we didn't expect, fail the test clearly.
            throw new Error(`ENOENT: mock for fs.realpath received an unexpected path: '${pathToResolve}'`);
        });

        // ACT
        const result = await parseNpmLinkOutput(npmLinkListLines, globalNodeModulesPath);

        console.log(result);

        // ASSERT
        // Check that the final map is exactly what we expect.
        expect(result).toEqual(expectedPackages);

        // You can also verify that `fs.realpath` was called the correct number of times.
        expect(fs.realpath).toHaveBeenCalledTimes(5);

        // And you can check the specific arguments it was called with.
        expect(fs.realpath).toHaveBeenCalledWith(path.join(globalNodeModulesPath, '@bobrmonkhouse/apichisel'));
        expect(fs.realpath).toHaveBeenCalledWith(path.join(globalNodeModulesPath, '@bobrmonkhouse/pm-link-auto'));
        
    });

    it('should handle broken symlinks gracefully', async () => {
        // ARRANGE
        const fs = await import('node:fs/promises');
        const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { }); // Suppress console output for the test

        const globalNodeModulesPath = "/test/node_modules";
        const npmLinkListLines = [
            '└── my-broken-link@1.0.0 -> ../../nowhere'
        ];

        // Make our mock throw an error, simulating a broken link.
        (fs.realpath as Mock).mockRejectedValue(new Error('ENOENT'));

        // ACT
        const result = await parseNpmLinkOutput(npmLinkListLines, globalNodeModulesPath);

        // ASSERT
        // The map should be empty because the link could not be resolved.
        expect(result.size).toBe(0);
        // Ensure a warning was logged.
        expect(consoleWarnSpy).toHaveBeenCalledOnce();
        expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining("Could not resolve link for 'my-broken-link'"));

        // Clean up the spy
        consoleWarnSpy.mockRestore();
    });
});
