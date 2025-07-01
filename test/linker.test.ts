// linker.test.ts

import { describe, it, expect, vi, beforeEach, afterEach, type Mocked, MockedFunction, MockedObject, MockInstance } from 'vitest';
import path from 'node:path';
import { runLinker } from '../src/linker';
import type { LinkerConfig } from '../src/types';

// --- Top-Level Mocks (Hoisted by Vitest) ---
// This is crucial. vi.mock must be at the top level to work correctly.

vi.mock('../src/utils', async (importOriginal) => {
    const original = await importOriginal<typeof import('../src/utils')>();
    return {
        ...original,
        // We mock the functions that have side effects (running commands, fs access)
        runCommand: vi.fn().mockResolvedValue({ stdout: '', stderr: '' }),
        getPackageNameFromPath: vi.fn(),
    };
});

// Mock this module to control the list of "already globally linked" packages
vi.mock('../src/getNpmLinkList.ts', () => ({
    getNpmLinkList: vi.fn().mockResolvedValue(new Map()),
}));

vi.mock('../src/config', async (importOriginal) => {
    const original = await importOriginal<typeof import('../src/config')>();
    return {
        ...original,
        updateConfigFile: vi.fn().mockResolvedValue(undefined),
    };
});

vi.mock('prompts', () => ({
    default: vi.fn(), // Default mock, will be overridden in tests
}));

vi.mock('glob', () => ({
    glob: vi.fn().mockResolvedValue([]),
}));


// --- Test Suite ---

describe('runLinker', () => {
    // Declare variables to hold the typed, mocked modules
    let MOCKED_UTILS: Mocked<typeof import('../src/utils')>;
    let MOCKED_CONFIG: Mocked<typeof import('../src/config')>;
    let MOCKED_GET_NPM_LINK_LIST: Mocked<typeof import('../src/getNpmLinkList')>;
    let MOCKED_PROMPTS: MockedFunction<any>; // Using `any` for prompts default export
    let MOCKED_GLOB: MockedObject<typeof import('glob')>;
    let consoleLogSpy: MockedFunction<typeof console.log> | MockInstance<typeof console.log>;


    // Use an async beforeEach to import the modules *after* they have been mocked
    beforeEach(async () => {
        // This is now an async context, so `await` is allowed.
        MOCKED_UTILS = vi.mocked(await import('../src/utils'));
        MOCKED_CONFIG = vi.mocked(await import('../src/config'));
        MOCKED_GET_NPM_LINK_LIST = vi.mocked(await import('../src/getNpmLinkList'));
        MOCKED_PROMPTS = vi.mocked((await import('prompts')).default);
        MOCKED_GLOB = vi.mocked(await import('glob'));

        // Reset mocks before each test to ensure isolation
        vi.clearAllMocks();

        // Spy on console.log to check for specific output messages
        consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        // Restore original console functionality
        consoleLogSpy.mockRestore();
    });

    it('should link a valid package successfully', async () => {
        const config: LinkerConfig = {
            packages: [{ name: '@my/package', path: '../libs/my-package' }],
        };
        const configPath = '/test/project/pm-link-auto.config.js';

        MOCKED_UTILS.getPackageNameFromPath.mockReturnValue('@my/package');
        // For this test, assume the package is NOT already globally linked
        MOCKED_GET_NPM_LINK_LIST.getNpmLinkList.mockResolvedValue(new Map());

        await runLinker(config, configPath, 'npm');

        // Check that global link was called
        expect(MOCKED_UTILS.runCommand).toHaveBeenCalledWith('npm link', expect.stringContaining('libs/my-package'));
        // Check that local link was called
        expect(MOCKED_UTILS.runCommand).toHaveBeenCalledWith('npm link @my/package', expect.any(String));
    });

    it('should not attempt to link an invalid package if user denies discovery', async () => {
        // This test was already present and covers the "user declines" scenario for discovery
        MOCKED_PROMPTS.mockResolvedValue({ shouldDiscover: false });

        const config: LinkerConfig = {
            packages: [{ name: '@my/package', path: '../libs/invalid-path' }],
        };
        const configPath = '/test/project/pm-link-auto.config.js';

        // Simulate invalid path
        MOCKED_UTILS.getPackageNameFromPath.mockReturnValue(null);
        MOCKED_GET_NPM_LINK_LIST.getNpmLinkList.mockResolvedValue(new Map());


        await runLinker(config, configPath, 'pnpm');

        // Prompt was shown
        expect(MOCKED_PROMPTS).toHaveBeenCalled();
        // No link commands should have been called because nothing was valid
        expect(MOCKED_UTILS.runCommand).not.toHaveBeenCalled();
        expect(MOCKED_CONFIG.updateConfigFile).not.toHaveBeenCalled();
    });

    it('should find a missing package and update the config when user allows discovery', async () => {
        MOCKED_PROMPTS.mockResolvedValue({ shouldDiscover: true });
        MOCKED_GLOB.glob.mockResolvedValue(['/Users/test/dev/found-package/package.json']);

        const config: LinkerConfig = {
            packageSearchRoot: '~/dev',
            packages: [{ name: '@my/package' }], // Path is missing
        };
        const configPath = '/test/project/pm-link-auto.config.js';

        MOCKED_UTILS.getPackageNameFromPath.mockImplementation((p) => {
            return p.includes('found-package') ? '@my/package' : null;
        });

        await runLinker(config, configPath, 'yarn');

        expect(MOCKED_PROMPTS).toHaveBeenCalledWith(expect.objectContaining({ name: 'shouldDiscover' }));
        expect(MOCKED_GLOB.glob).toHaveBeenCalledWith('**/package.json', expect.any(Object));
        expect(MOCKED_CONFIG.updateConfigFile).toHaveBeenCalledWith(
            configPath,
            '@my/package',
            expect.stringContaining('found-package')
        );
        // It should exit after updating the config, so no linking commands are called yet
        expect(MOCKED_UTILS.runCommand).not.toHaveBeenCalled();
    });

    // --- NEW TEST BLOCK 1 ---
    describe('when a package is already linked correctly', () => {
        it('should recognize the correct link and skip re-linking globally', async () => {
            const config: LinkerConfig = {
                packages: [{ name: 'pkg-a', path: '../libs/pkg-a' }],
            };
            const configPath = '/test/project/pm-link-auto.config.js';
            const correctPath = path.resolve('/test/project', '../libs/pkg-a');

            // Simulate that the package is valid
            MOCKED_UTILS.getPackageNameFromPath.mockReturnValue('pkg-a');
            // Simulate that `npm list -g` finds the package linked to the EXACT correct path
            MOCKED_GET_NPM_LINK_LIST.getNpmLinkList.mockResolvedValue(new Map([
                ['pkg-a', correctPath]
            ]));

            await runLinker(config, configPath, 'npm');

            // Assert that the 'already linked' message was shown
            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("'pkg-a' is already linked correctly."));

            // Assert that NO global link or unlink commands were run
            expect(MOCKED_UTILS.runCommand).not.toHaveBeenCalledWith('npm link', expect.any(String));
            expect(MOCKED_UTILS.runCommand).not.toHaveBeenCalledWith(expect.stringContaining('npm unlink'));

            // Assert that it STILL links the package to the local project
            expect(MOCKED_UTILS.runCommand).toHaveBeenCalledWith('npm link pkg-a', expect.any(String));
        });
    });

    // --- NEW TEST BLOCK 2 ---
    describe('when a package is linked from a conflicting path', () => {
        const config: LinkerConfig = {
            packages: [{ name: 'pkg-b', path: '../libs/correct-path/pkg-b' }],
        };
        const configPath = '/test/project/pm-link-auto.config.js';
        const correctPath = path.resolve('/test/project', '../libs/correct-path/pkg-b');
        const incorrectPath = '/some/other/dev/folder/pkg-b';

        beforeEach(() => {
            // For all tests in this block, simulate a valid package...
            MOCKED_UTILS.getPackageNameFromPath.mockReturnValue('pkg-b');
            // ...that is currently linked to the WRONG location.
            MOCKED_GET_NPM_LINK_LIST.getNpmLinkList.mockResolvedValue(new Map([
                ['pkg-b', incorrectPath]
            ]));
        });

        it('should prompt the user and relink when they approve', async () => {
            // User says "yes" to the prompt
            MOCKED_PROMPTS.mockResolvedValue({ shouldRelink: true });

            await runLinker(config, configPath, 'yarn');

            // Check that the user was prompted about the conflict
            expect(MOCKED_PROMPTS).toHaveBeenCalledWith(expect.objectContaining({ name: 'shouldRelink' }));
            
            // Check that the old link was removed
            expect(MOCKED_UTILS.runCommand).toHaveBeenCalledWith('yarn unlink pkg-b');

            // Check that the new link was created from the correct source path
            expect(MOCKED_UTILS.runCommand).toHaveBeenCalledWith('yarn link', correctPath);

            // Check that the final local link was still performed
            expect(MOCKED_UTILS.runCommand).toHaveBeenCalledWith('yarn link pkg-b', expect.any(String));
        });

        it('should skip relinking if the user declines', async () => {
            // User says "no" to the prompt
            MOCKED_PROMPTS.mockResolvedValue({ shouldRelink: false });

            await runLinker(config, configPath, 'npm');
            
            // Check that the user was prompted
            expect(MOCKED_PROMPTS).toHaveBeenCalledWith(expect.objectContaining({ name: 'shouldRelink' }));

            // Assert that NO global unlink or link commands were run
            expect(MOCKED_UTILS.runCommand).not.toHaveBeenCalledWith(expect.stringContaining('npm unlink'));
            expect(MOCKED_UTILS.runCommand).not.toHaveBeenCalledWith('npm link', correctPath);

            // It should still attempt to link the (conflicting) package to the local project
            expect(MOCKED_UTILS.runCommand).toHaveBeenCalledWith('npm link pkg-b', expect.any(String));

            // Check for the "Skipping" message
            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("Skipping link for 'pkg-b'"));
        });
    });
});