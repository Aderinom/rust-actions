export interface Input {
    project: string;
    profile?: string;
    run: string[];
    cacheKey: string;
    toolchain?: string;
    extraComponents?: string[];
    installOnly?: boolean;
    installAdditional?: string[];
    buildCacheStrategy: string;
    buildCacheFallbackBranch: string;
    flow: {
        test: {
            toolchain?: string;
            overrideArgs?: string;
            failFast: boolean;
        };
        clippy: {
            toolchain?: string;
            overrideArgs?: string;
            denyWarnings: boolean;
        };
        fmt: {
            toolchain?: string;
            overrideArgs?: string;
        };
        doc: {
            toolchain?: string;
            overrideArgs?: string;
            denyWarnings: boolean;
        };
        shear: {
            toolchain?: string;
            overrideArgs?: string;
        };
        deny: {
            toolchain?: string;
            overrideArgs?: string;
        };
    };
}
export declare function loadInput(): Input;
