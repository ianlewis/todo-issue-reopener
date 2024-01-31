"use strict";
// Copyright 2023 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.reopenIssues = exports.getTODOIssues = exports.matchLabel = exports.TODOIssue = exports.TODORef = exports.ReopenError = void 0;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const core = __importStar(require("@actions/core"));
const exec = __importStar(require("@actions/exec"));
const github = __importStar(require("@actions/github"));
const verifier = __importStar(require("./verifier"));
const TODOS_VERSION = "v0.7.0";
const SLSA_VERIFIER_VERSION = "v2.3.0";
const SLSA_VERIFIER_SHA256SUM = "ea687149d658efecda64d69da999efb84bb695a3212f29548d4897994027172d";
class ReopenError extends Error {
    constructor(message) {
        super(message);
        // Set the prototype explicitly.
        Object.setPrototypeOf(this, ReopenError.prototype);
    }
}
exports.ReopenError = ReopenError;
// TODORef is a reference to a TODO comment.
class TODORef {
    constructor() {
        this.path = "";
        this.type = "";
        this.text = "";
        this.label = "";
        this.message = "";
        this.line = 0;
        this.comment_line = 0;
    }
}
exports.TODORef = TODORef;
// TODOIssue is a GitHub issue referenced by one or more TODOs.
class TODOIssue {
    constructor(issueID) {
        this.todos = [];
        this.issueID = issueID;
    }
}
exports.TODOIssue = TODOIssue;
const labelMatch = new RegExp("^\\s*((https?://)?github.com/(.+)/(.+)/issues/|#?)([0-9]+)\\s*$");
// matchLabel matches the label and returns the GitHub issue number or -1 if
// there is no match.
function matchLabel(label, conf) {
    const repo = github.context.repo;
    const match = label.match(labelMatch);
    if (match) {
        // NOTE: Skip the issue if it links to another repository.
        if ((match[3] || match[4]) &&
            (match[3] !== repo.owner || match[4] !== repo.repo)) {
            return -1;
        }
        return Number(match[5]);
    }
    // Try vanity urls.
    core.debug(`Vanity URLs: ${conf.vanityURLs}`);
    if (conf && conf.vanityURLs) {
        for (const urlMatch of conf.vanityURLs) {
            try {
                // Match the url and get the 'id' named capture group.
                const r = new RegExp(urlMatch);
                const m = r.exec(label);
                if (m && m.groups) {
                    return Number(m.groups.id);
                }
            }
            catch (e) {
                const msg = String(e);
                core.warning(`error parsing vanity url regex: ${msg}`);
            }
        }
    }
    return -1;
}
exports.matchLabel = matchLabel;
// reopenIssues downloads the todos CLI, runs it, and returns issues linked to TODOs.
function getTODOIssues(wd, conf) {
    return __awaiter(this, void 0, void 0, function* () {
        const todosPath = yield verifier.downloadAndVerifySLSA(`https://github.com/ianlewis/todos/releases/download/${TODOS_VERSION}/todos-linux-amd64`, `https://github.com/ianlewis/todos/releases/download/${TODOS_VERSION}/todos-linux-amd64.intoto.jsonl`, "github.com/ianlewis/todos", TODOS_VERSION, SLSA_VERIFIER_VERSION, SLSA_VERIFIER_SHA256SUM);
        core.debug(`Setting ${todosPath} as executable`);
        yield fs.chmod(todosPath, 0o700);
        core.debug(`Running git to get repository root`);
        const { stdout: gitOut } = yield exec.getExecOutput("git", ["rev-parse", "--show-toplevel"], {
            cwd: wd,
        });
        const repoRoot = gitOut.trim();
        core.debug(`Running todos (${todosPath})`);
        const { exitCode, stdout, stderr } = yield exec.getExecOutput(todosPath, 
        // TODO: get new relative directory to repoRoot
        ["--output=json", path.relative(repoRoot, wd)], {
            cwd: repoRoot,
            ignoreReturnCode: true,
        });
        core.debug(`Ran todos (${todosPath})`);
        if (exitCode !== 0) {
            throw new ReopenError(`todos exited ${exitCode}: ${stderr}`);
        }
        // Parse stdout into list of TODORef grouped by issue.
        const issueMap = new Map();
        for (let line of stdout.split("\n")) {
            line = line.trim();
            if (line === "") {
                continue;
            }
            const ref = JSON.parse(line);
            const issueNum = matchLabel(ref.label, conf);
            if (issueNum <= 0) {
                continue;
            }
            let issue = issueMap.get(issueNum);
            if (!issue) {
                issue = new TODOIssue(issueNum);
            }
            issue.todos.push(ref);
            issueMap.set(issueNum, issue);
        }
        return Array.from(issueMap.values());
    });
}
exports.getTODOIssues = getTODOIssues;
// reopenIssues reopens issues linked to TODOs.
function reopenIssues(wd, issues, token, dryRun) {
    return __awaiter(this, void 0, void 0, function* () {
        const octokit = github.getOctokit(token);
        const repo = github.context.repo;
        const sha = github.context.sha;
        for (const issueRef of issues) {
            if (issueRef.todos.length === 0) {
                continue;
            }
            const resp = yield octokit.rest.issues.get({
                owner: repo.owner,
                repo: repo.repo,
                issue_number: issueRef.issueID,
            });
            const issue = resp.data;
            if (issue.state === "open") {
                continue;
            }
            let msgPrefix = "";
            if (dryRun) {
                msgPrefix = "[dry-run] ";
            }
            core.info(`${msgPrefix}Reopening https://github.com/${repo.owner}/${repo.repo}/issues/${issueRef.issueID} : ${issue.title}`);
            if (dryRun) {
                continue;
            }
            // Reopen the issue.
            yield octokit.rest.issues.update({
                owner: repo.owner,
                repo: repo.repo,
                issue_number: issueRef.issueID,
                state: "open",
            });
            let body = "There are TODOs referencing this issue:\n";
            for (const [i, todo] of issueRef.todos.entries()) {
                // NOTE: Get the path from the root of the repository.
                body += `${i + 1}. [${todo.path}:${todo.line}](https://github.com/${repo.owner}/${repo.repo}/blob/${sha}/${todo.path}#L${todo.line}): ${todo.message}\n`;
            }
            // Post the comment.
            yield octokit.rest.issues.createComment({
                owner: repo.owner,
                repo: repo.repo,
                issue_number: issueRef.issueID,
                body,
            });
        }
    });
}
exports.reopenIssues = reopenIssues;
