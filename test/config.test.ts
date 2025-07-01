import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { updateConfigFile } from '../src/config.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

// This test suite performs "live" file system operations in a temporary directory.
describe('updateConfigFile (Live File System)', () => {
    let tempDir: string;

    // Create a unique temporary directory before each test
    beforeEach(async () => {
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pm-link-auto-test-'));
    });

    // Clean up the temporary directory after each test
    afterEach(async () => {
        if (tempDir) {
            await fs.rm(tempDir, { recursive: true, force: true });
        }
    });

    it('should add a path to a simple package that is missing one', async () => {
        // --- Arrange ---
        const packageName = 'my-lib';
        const newPath = '../../libs/my-lib';
        const initialContent = `
      // Simple config
      export default {
        packages: [
          { name: 'my-lib' }
        ]
      };
    `.trim();
        const expectedContent = `
      // Simple config
      export default {
        packages: [
          {
            name: 'my-lib',
            path: '../../libs/my-lib'
          }
        ]
      };
    `.trim();

        const configFilePath = path.join(tempDir, 'pm-link-auto.config.ts');
        await fs.writeFile(configFilePath, initialContent);

        // --- Act ---
        await updateConfigFile(configFilePath, packageName, newPath);

        // --- Assert ---
        const updatedContent = await fs.readFile(configFilePath, 'utf-8');
        expect(updatedContent.trim()).toBe(expectedContent);
    });


    it('should handle a split const and default', async () => {
        // --- Arrange ---
        const packageName = 'my-lib';
        const newPath = '../../libs/my-lib';
        const initialContent = `
      // Simple config
      type MyPackage = {packages:any[]};
      const config:MyPackage = {
        packages: [
          { name: 'my-lib' }
        ]
      };
      export default config;
    `.trim();
        const expectedContent = `
      // Simple config
      type MyPackage = {packages:any[]};
      const config:MyPackage = {
        packages: [
          {
            name: 'my-lib',
            path: '../../libs/my-lib'
          }
        ]
      };
      export default config;
    `.trim();

        const configFilePath = path.join(tempDir, 'pm-link-auto.config.ts');
        await fs.writeFile(configFilePath, initialContent);

        // --- Act ---
        await updateConfigFile(configFilePath, packageName, newPath);

        // --- Assert ---
        const updatedContent = await fs.readFile(configFilePath, 'utf-8');
        expect(updatedContent.trim()).toBe(expectedContent);
    });

    it('should update the path of a scoped package that already has one', async () => {
        // --- Arrange ---
        const packageName = '@scope/pkg';
        const newPath = '../new/location/for/pkg';
        const initialContent = `
      import type { LinkerConfig } from 'pm-link-auto';
      const config: LinkerConfig = {
        packages: [
          { name: '@scope/pkg', path: './old/path' }
        ]
      };
      export default config;
    `.trim();
        const expectedContent = `
      import type { LinkerConfig } from 'pm-link-auto';
      const config: LinkerConfig = {
        packages: [
          { name: '@scope/pkg', path: '../new/location/for/pkg' }
        ]
      };
      export default config;
    `.trim();

        const configFilePath = path.join(tempDir, 'pm-link-auto.config.ts');
        await fs.writeFile(configFilePath, initialContent);

        // --- Act ---
        await updateConfigFile(configFilePath, packageName, newPath);

        // --- Assert ---
        const updatedContent = await fs.readFile(configFilePath, 'utf-8');
        expect(updatedContent.trim()).toBe(expectedContent);
    });

    it('should preserve comments and complex formatting when updating a path', async () => {
        // --- Arrange ---
        const packageName = '@scope/ui';
        const newPath = '../new-ui-path/for/the/win';
        const initialContent = `
      // My amazing config file
      import type { LinkerConfig } from 'pm-link-auto';

      const config: LinkerConfig = {
        packageSearchRoot: '~/dev', // Look here!

        packages: [
          // The main UI library
          {
            name: '@scope/ui', // This is the one we want
            path: '../old/ui-path'
          },
        ],
      };

      export default config;
    `.trim();
        const expectedContent = `
      // My amazing config file
      import type { LinkerConfig } from 'pm-link-auto';

      const config: LinkerConfig = {
        packageSearchRoot: '~/dev', // Look here!

        packages: [
          // The main UI library
          {
            name: '@scope/ui', // This is the one we want
            path: '../new-ui-path/for/the/win'
          },
        ],
      };

      export default config;
    `.trim();

        const configFilePath = path.join(tempDir, 'pm-link-auto.config.ts');
        await fs.writeFile(configFilePath, initialContent);

        // --- Act ---
        await updateConfigFile(configFilePath, packageName, newPath);

        // --- Assert ---
        const updatedContent = await fs.readFile(configFilePath, 'utf-8');
        expect(updatedContent.trim()).toBe(expectedContent);
    });

    it('should correctly add a path to a package with a dash in its name', async () => {
        // --- Arrange ---
        const packageName = 'pkg-with-dash';
        const newPath = '../libs/pkg-with-dash';
        const initialContent = `
      export default {
        packages: [
          { name: 'pkg-one', path: './one' },
          { name: 'pkg-with-dash' },
          { name: 'pkg-three', path: './three' },
        ]
      }
    `.trim();
        const expectedContent = `
      export default {
        packages: [
          { name: 'pkg-one', path: './one' },
          {
            name: 'pkg-with-dash',
            path: '../libs/pkg-with-dash'
          },
          { name: 'pkg-three', path: './three' },
        ]
      }
    `.trim();

        const configFilePath = path.join(tempDir, 'pm-link-auto.config.ts');
        await fs.writeFile(configFilePath, initialContent);

        // --- Act ---
        await updateConfigFile(configFilePath, packageName, newPath);

        // --- Assert ---
        const updatedContent = await fs.readFile(configFilePath, 'utf-8');
        expect(updatedContent.trim()).toBe(expectedContent);
    });

    it('should not modify the file if the package name is not found', async () => {
        // --- Arrange ---
        const initialContent = `
      export default {
        packages: [{ name: 'existing-package', path: './path' }]
      };
    `.trim();

        const configFilePath = path.join(tempDir, 'pm-link-auto.config.ts');
        await fs.writeFile(configFilePath, initialContent);

        // --- Act ---
        await updateConfigFile(configFilePath, 'non-existent-package', '../new/path');

        // --- Assert ---
        const finalContent = await fs.readFile(configFilePath, 'utf-8');
        expect(finalContent).toBe(initialContent);
    });
});