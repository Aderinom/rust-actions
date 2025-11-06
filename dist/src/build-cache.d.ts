export declare function restoreBuildCache(projectDir: string, toolchains: string[], fallbackBranch: string): Promise<void>;
export declare function saveBuildCache(projectDir: string, toolchains: string[], fallbackBranch: string): Promise<void>;
export declare function buildCacheStrategy(projectDir: string, strategy: string, toolchains: string[], fallbackBranch: string): {
    restore: () => Promise<void>;
    save: () => Promise<void>;
} | undefined;
