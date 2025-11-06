export declare function listToolchains(): Promise<string[]>;
export declare function listInstalledComponents(toolchain?: string): Promise<string[]>;
export declare function isComponentInstalled(component: string, toolchain?: string): Promise<boolean>;
export declare function installComponent(component: string, toolchain?: string): Promise<void>;
export declare function getGlobalDefaultToolchain(): Promise<string | undefined>;
export declare function setDefaultToolchain(toolchain: string): Promise<void>;
export declare function getHostTriple(): Promise<string>;
export declare function prepareToolchain(startTime: number, toolchain: string, additionalComponents?: string[], cachePrefix?: string): Promise<void>;
