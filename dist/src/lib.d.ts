import { Input } from './input.js';
interface RunResult {
    installedToolchains: string[];
    installedTools: [string, string][];
    workflowResults: Record<string, true | string>;
    succeeded: boolean;
}
export declare function run(cfg: Input): Promise<RunResult>;
export declare function addCargoToPath(): void;
export declare function timeSinceStart(start: number): string;
export {};
