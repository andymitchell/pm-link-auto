export interface PackageEntry {
    name: string;
    path?: string;
}

export interface ValidatedPackageEntry extends PackageEntry {
    path: string; // Path is guaranteed to be a string here
}

export interface LinkerConfig {
    packageSearchRoot?: string;
    packages: PackageEntry[];
}

export interface LoadedConfig {
    config: LinkerConfig;
    filepath: string;
}

export type PackageManager = 'npm' | 'pnpm' | 'yarn';