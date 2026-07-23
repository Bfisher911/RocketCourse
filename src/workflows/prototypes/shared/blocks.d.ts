// Minimal type surface of blocks.js for TypeScript consumers (WorkflowHost).
// The full facade shape is dynamic by design; the adapter owns its semantics.

import type { SessionTarget } from "../../courseAdapter";

export declare const session: SessionTarget["session"];
export declare const D: SessionTarget["D"];
export declare function getBindTarget(): SessionTarget;
export declare function onChange(fn: () => void): () => void;
export declare function resolveIssue(id: string): void;
export declare function openIssuesCount(): number;
