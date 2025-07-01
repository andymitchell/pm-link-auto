import type { LinkerConfig } from '@andyrmitchell/pm-link-auto';

const config: LinkerConfig = {
    // Optional: The root directory to search for packages if a path is missing.
    // Supports `~` for home directory. Defaults to your home directory.
    packageSearchRoot: '~/git',

    // A list of packages you need to link.
    packages: [
        {
            name: '@pm-link-auto-test/unpublished-lib',
            // Optional: The tool will try to discover the path if you omit it.
            // Path is relative to this config file.
            path: '/Users/andymitchell/git/breef/pm-link-auto/test/live/unpublished-lib',
        }, 
        {
          name: "@andyrmitchell/store",
          path: '/Users/andymitchell/git/breef/store'
        },
        {
          name: "@andyrmitchell/objects",
          path: '/Users/andymitchell/git/breef/objects'
        },
    ],
};

export default config;