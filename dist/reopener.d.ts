import type * as config from "./config.js";
/**
 * ReopenError represents an error that occurred when reopening an issue.
 */
export declare class ReopenError extends Error {
    constructor(message: string);
}
/**
 * TODORef represents a reference to a TODO comment.
 */
export declare class TODORef {
    path: string;
    type: string;
    text: string;
    label: string;
    message: string;
    line: number;
    comment_line: number;
}
/**
 * TODOIssue represents a GitHub issue referenced by one or more TODOs.
 */
export declare class TODOIssue {
    issueID: number;
    todos: TODORef[];
    constructor(issueID: number);
}
/**
 * matchLabel matches the label and returns the GitHub issue number or -1 if
 * there is no match.
 * @param {string} label The label to match against.
 * @param {config.Config} conf The action configuration.
 */
export declare function matchLabel(label: string, conf: config.Config): number;
/**
 * getTODOIssues is an async function that downloads the todos CLI, runs it,
 * and returns issues linked to TODOs.
 * @param {string} wd The working directory to run todos in.
 * @param {config.Config} conf The action configuration.
 * @return {Promise<TODOIssue[]>} The issues and linked TODOs.
 */
export declare function getTODOIssues(wd: string, conf: config.Config): Promise<TODOIssue[]>;
/**
 * reopenIssues is an async function that reopens issues linked to TODOs.
 * @param {TODOIssue[]} issues The issues and associate TODOs.
 * @param {string} token The GITHUB_TOKEN to authenticate with.
 * @param {boolean} dryRun true if running in dry-run mode.
 */
export declare function reopenIssues(issues: TODOIssue[], token: string, dryRun: boolean): Promise<void>;
