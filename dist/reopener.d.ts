import * as config from "./config.js";
export declare class ReopenError extends Error {
    constructor(message: string);
}
export declare class TODORef {
    path: string;
    type: string;
    text: string;
    label: string;
    message: string;
    line: number;
    comment_line: number;
}
export declare class TODOIssue {
    issueID: number;
    todos: TODORef[];
    constructor(issueID: number);
}
export declare function matchLabel(label: string, conf: config.Config): number;
export declare function getTODOIssues(wd: string, conf: config.Config): Promise<TODOIssue[]>;
export declare function reopenIssues(wd: string, issues: TODOIssue[], token: string, dryRun: boolean): Promise<void>;
declare const _default: {
    ReopenError: typeof ReopenError;
    TODORef: typeof TODORef;
    matchLabel: typeof matchLabel;
    getTODOIssues: typeof getTODOIssues;
    reopenIssues: typeof reopenIssues;
};
export default _default;
