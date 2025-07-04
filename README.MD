
# @andyrmitchell/pm-link-auto


Tired of manually running `npm link` for local packages every time you switch branches or a new developer joins the team? `pm-link-auto` automates the entire process.

It reads a simple config file in your project, validates the paths to your local dependencies, finds them if the paths are missing, and runs the necessary `npm`, `pnpm`, or `yarn` link commands to set everything up correctly.

## The Problem

Early in a project, it may be depending on libraries that are also not ready to publish yet. This leaves it to the developer to maintain `npm link` to local files on the machine. 

1.  **Onboarding Pain:** When adding a new developer or switching branches, and it has to use local packages, you can end up with incorrect linking.
2.  **Fragile Links:** Running `npm install` can sometimes break existing links, forcing you to re-link them.
3.  **No Single Source of Truth:** It's not obvious which local packages a project depends on. The information is scattered across developers' machines.

## The Solution

`pm-link-auto` provides a single, version-controllable configuration file that declares all local development dependencies. Running one command handles the rest.

-   ✅ **Declarative:** Define all local dependencies in a configuration file.
-   ✅ **Auto-Discovery:** If a path is missing, the tool can search a root directory to find it.
-   ✅ **Auto-Configuration:** It updates your config file with the paths it finds.
-   ✅ **Automated:** Runs all the necessary `link` commands for you.
-   ✅ **Package Manager Agnostic:** Works with `npm`, `pnpm`, and `yarn`.

## Installation

Install the tool as a development dependency in your project.

```bash
npm install -D @andyrmitchell/pm-link-auto
```

## Usage

1.  **Create a configuration file** in your project's root directory named `pm-link-auto.config.ts`. Using TypeScript gives you the best editor support and type safety.

    ```typescript
    // pm-link-auto.config.ts

    import type { LinkerConfig } from '@andyrmitchell/pm-link-auto';

    const config: LinkerConfig = {
      // Optional: The root directory to search for packages if a path is missing.
      // Supports `~` for home directory. Defaults to your home directory.
      packageSearchRoot: '~/dev/projects',

      // A list of packages you need to link.
      packages: [
        {
          name: '@my-scope/shared-ui',
          // Optional: The tool will try to discover the path if you omit it.
          // Path is relative to this config file.
          path: '../../shared-ui',
        },
        {
          name: '@my-scope/auth-library',
          // Path is missing, so the tool will search for it in `packageSearchRoot`.
        },
      ],
    };

    export default config;
    ```
    *(Note: You can also use a `.js` file if you prefer.)*

2.  **Run the linker:**

    ```bash
    npx pm-link-auto
    ```

    The tool will validate the paths, ask for permission to find any missing ones, update the config file, and perform the linking.

3.  **(Recommended) Add to `postinstall`**

    To make this fully automatic, add it to your `package.json` `scripts`. This way, links are refreshed after every `npm install`.

    ```json
    "scripts": {
      "postinstall": "pm-link-auto"
    }
    ```

## License

MIT