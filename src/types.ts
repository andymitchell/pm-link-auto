export interface PackageEntry {
    /**
     * The package name, as it appears in package.json
     */
    name: string;

    /**
     * The absolute or relative path to the package on this machine. 
     * 
     * If it's missing, or wrong, then pm-link-auto will attempt to reconcile it for you. 
     */
    path?: string;
}

export interface ValidatedPackageEntry extends PackageEntry {
    path: string; // Path is guaranteed to be a string here
}

export interface LinkerConfig {
    /**
     * Optional: The root directory to search for packages if a path is missing
     * Supports `~` for home directory. 
     * @default "~"
     */
    packageSearchRoot?: string;

    /**
     * A list of packages you need to link.
     */
    packages: PackageEntry[];
}

export interface LoadedConfig {
    config: LinkerConfig;
    filepath: string;
}

export type PackageManager = 'npm' | 'pnpm' | 'yarn';