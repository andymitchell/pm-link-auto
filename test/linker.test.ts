import { describe, it, expect, vi, beforeEach, type Mocked, MockedFunction, MockedObject } from 'vitest';
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

vi.mock('../src/config', async (importOriginal) => {
    const original = await importOriginal<typeof import('../src/config')>();
    return {
        ...original,
        updateConfigFile: vi.fn().mockResolvedValue(undefined),
    };
});

vi.mock('prompts', () => ({
    default: vi.fn().mockResolvedValue({ shouldDiscover: true }),
}));

vi.mock('glob', () => ({
    glob: vi.fn().mockResolvedValue([]),
}));

// --- Test Suite ---

describe('runLinker', () => {
    // Declare variables to hold the typed, mocked modules
    let MOCKED_UTILS: Mocked<typeof import('../src/utils')>;
    let MOCKED_CONFIG: Mocked<typeof import('../src/config')>;
    let MOCKED_PROMPTS: MockedFunction<typeof import('prompts')>;//Mocked<typeof import('prompts')>;
    let MOCKED_GLOB: MockedObject<typeof import('glob')>;

    // Use an async beforeEach to import the modules *after* they have been mocked
    beforeEach(async () => {
        // This is now an async context, so `await` is allowed.
        MOCKED_UTILS = vi.mocked(await import('../src/utils'));
        MOCKED_CONFIG = vi.mocked(await import('../src/config'));
        MOCKED_PROMPTS = vi.mocked((await import('prompts')).default);
        MOCKED_GLOB = vi.mocked(await import('glob'));

        // Reset mocks before each test to ensure isolation
        vi.clearAllMocks();
    });

    it('should link a valid package successfully', async () => {
        const config: LinkerConfig = {
            packages: [{ name: '@my/package', path: '../libs/my-package' }],
        };
        const configPath = '/test/project/pm-link-auto.config.js';

        MOCKED_UTILS.getPackageNameFromPath.mockReturnValue('@my/package');
        // For this test, assume the package is NOT already globally linked
        MOCKED_UTILS.runCommand.mockImplementation(async (command) => {
            if (command.startsWith('npm list')) return { stdout: 'empty list', stderr: '' };
            return { stdout: 'some output', stderr: '' };
        });

        await runLinker(config, configPath, 'npm');

        // Check that global link was called
        expect(MOCKED_UTILS.runCommand).toHaveBeenCalledWith('npm link', expect.stringContaining('libs/my-package'));
        // Check that local link was called
        expect(MOCKED_UTILS.runCommand).toHaveBeenCalledWith('npm link @my/package', expect.any(String));
    });

    it('should not attempt to link an invalid package if user denies discovery', async () => {
        MOCKED_PROMPTS.mockResolvedValue({ shouldDiscover: false });

        const config: LinkerConfig = {
            packages: [{ name: '@my/package', path: '../libs/invalid-path' }],
        };
        const configPath = '/test/project/pm-link-auto.config.js';

        // Simulate invalid path
        MOCKED_UTILS.getPackageNameFromPath.mockReturnValue(null);

        await runLinker(config, configPath, 'pnpm');

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

        // Setup mocks for this specific flow
        MOCKED_UTILS.getPackageNameFromPath.mockImplementation((p) => {
            // Only return a valid name for the "found" package
            return p.includes('found-package') ? '@my/package' : null;
        });
        // For this test, assume the package is NOT already globally linked
        MOCKED_UTILS.runCommand.mockImplementation(async (command) => {
            if (command.startsWith('yarn link')) return { stdout: '', stderr: '' };
            return { stdout: 'empty list', stderr: '' };
        });

        await runLinker(config, configPath, 'yarn');

        // Check that the file system was searched
        expect(MOCKED_GLOB.glob).toHaveBeenCalledWith('**/package.json', expect.any(Object));

        // Check that config was updated
        expect(MOCKED_CONFIG.updateConfigFile).toHaveBeenCalledWith(
            configPath,
            '@my/package',
            expect.stringContaining('found-package')
        );
        
    });

    it('should skip global linking if package is already linked', async () => {
        const config: LinkerConfig = {
            packages: [{ name: '@my/package', path: '../libs/my-package' }],
        };
        const configPath = '/test/project/pm-link-auto.config.js';

        MOCKED_UTILS.getPackageNameFromPath.mockReturnValue('@my/package');
        // Simulate `npm list` returning the package
        MOCKED_UTILS.runCommand.mockImplementation(async (command) => {
            if (command.startsWith('npm list')) return { stdout: '@my/package@1.0.0 -> /path/to/pkg', stderr: '' };
            return { stdout: 'some output', stderr: '' };
        });

        await runLinker(config, configPath, 'npm');

        // The global `npm link` command in the package's directory should NOT be called
        expect(MOCKED_UTILS.runCommand).not.toHaveBeenCalledWith('npm link', expect.stringContaining('libs/my-package'));
        // The local `npm link @my/package` command SHOULD be called
        expect(MOCKED_UTILS.runCommand).toHaveBeenCalledWith('npm link @my/package', expect.any(String));
    });
});