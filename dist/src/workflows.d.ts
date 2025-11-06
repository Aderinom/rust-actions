import { Input } from './input';
export interface Workflow {
    readonly name: string;
    readonly run: () => Promise<void>;
    readonly requiredTools: [string, string][];
    readonly config: FlowConfig<any>;
}
export declare class TestWorkflow implements Workflow {
    readonly config: FlowConfig<'test'>;
    readonly name = "test";
    readonly requiredTools: [string, string][];
    constructor(config: FlowConfig<'test'>);
    run(): Promise<void>;
}
export declare class ClippyWorkflow implements Workflow {
    readonly config: FlowConfig<'clippy'>;
    readonly name = "clippy";
    readonly requiredTools: [string, string][];
    constructor(config: FlowConfig<'clippy'>);
    run(): Promise<void>;
}
export declare class FormatWorkflow implements Workflow {
    readonly config: FlowConfig<'fmt'>;
    readonly name = "fmt";
    readonly requiredTools: [string, string][];
    constructor(config: FlowConfig<'fmt'>);
    run(): Promise<void>;
}
export declare class DocsWorkflow implements Workflow {
    readonly config: FlowConfig<'doc'>;
    readonly name = "doc";
    readonly requiredTools: [string, string][];
    constructor(config: FlowConfig<'doc'>);
    run(): Promise<void>;
}
export declare class ShearWorkflow implements Workflow {
    readonly config: FlowConfig<'shear'>;
    readonly name = "shear";
    readonly requiredTools: [string, string][];
    constructor(config: FlowConfig<'shear'>);
    run(): Promise<void>;
}
export declare class DenyWorkflow implements Workflow {
    readonly config: FlowConfig<'deny'>;
    readonly name = "deny";
    readonly requiredTools: [string, string][];
    constructor(config: FlowConfig<'deny'>);
    run(): Promise<void>;
}
export type FlowConfig<T extends keyof Input['flow']> = Omit<Input['flow'][T], 'overrideArgs'> & {
    project: string;
    cacheKey: string;
    buildProfile?: string;
    toolchain?: string;
    overrideArgs?: string[];
};
export declare function workflowConfig<T extends keyof Input['flow']>(cfg: Input, flow: T): FlowConfig<T>;
