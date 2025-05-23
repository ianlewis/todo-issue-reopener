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

import fs from "fs/promises";
import path from "path";
import { env } from "process";

import * as core from "@actions/core";
import * as exec from "@actions/exec";
import * as github from "@actions/github";
import { retry } from "@octokit/plugin-retry";

import * as verifier from "./verifier.js";
import type * as config from "./config.js";

// renovate: datasource=github-releases depName=ianlewis/todos versioning=loose
const TODOS_VERSION = "v0.13.0";
// renovate: datasource=github-releases depName=slsa-framework/slsa-verifier versioning=loose
const SLSA_VERIFIER_VERSION = "v2.7.0";
// See: https://github.com/slsa-framework/slsa-verifier/blob/main/SHA256SUM.md
const SLSA_VERIFIER_SHA256SUM =
  "499befb675efcca9001afe6e5156891b91e71f9c07ab120a8943979f85cc82e6";

/**
 * ReopenError represents an error that occurred when reopening an issue.
 */
export class ReopenError extends Error {
  constructor(message: string) {
    super(message);

    // Set the prototype explicitly.
    Object.setPrototypeOf(this, ReopenError.prototype);
  }
}

/**
 * TODORef represents a reference to a TODO comment.
 */
export class TODORef {
  path = "";
  type = "";
  text = "";
  label = "";
  message = "";
  line = 0;
  comment_line = 0;
}

/**
 * TODOIssue represents a GitHub issue referenced by one or more TODOs.
 */
export class TODOIssue {
  issueID: number;
  todos: TODORef[] = [];

  constructor(issueID: number) {
    this.issueID = issueID;
  }
}

const labelMatch = new RegExp(
  "^\\s*((https?://)?github.com/(.+)/(.+)/issues/|#?)([0-9]+)\\s*$",
);

/**
 * matchLabel matches the label and returns the GitHub issue number or NaN if
 * there is no match.
 * @param {string} label The label to match against.
 * @param {config.Config} conf The action configuration.
 */
export function matchLabel(label: string, conf: config.Config): number {
  const repo = github.context.repo;
  const match = label.match(labelMatch);

  if (match) {
    // NOTE: Skip the issue if it links to another repository.
    if (
      (match[3] || match[4]) &&
      (match[3] !== repo.owner || match[4] !== repo.repo)
    ) {
      return NaN;
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

        if (!m || !m.groups || !m.groups.id) {
          continue;
        }

        return Number(m.groups.id);
      } catch (e) {
        const msg = String(e);
        core.warning(`error parsing vanity url regex: ${msg}`);
      }
    }
  }

  return NaN;
}

/**
 * getTODOIssues is an async function that downloads the todos CLI, runs it,
 * and returns issues linked to TODOs.
 * @param {string} wd The working directory to run todos in.
 * @param {config.Config} conf The action configuration.
 * @return {Promise<TODOIssue[]>} The issues and linked TODOs.
 */
export async function getTODOIssues(
  wd: string,
  conf: config.Config,
): Promise<TODOIssue[]> {
  const todosPath = await verifier.downloadAndVerifySLSA(
    `https://github.com/ianlewis/todos/releases/download/${TODOS_VERSION}/todos-linux-amd64`,
    `https://github.com/ianlewis/todos/releases/download/${TODOS_VERSION}/todos-linux-amd64.intoto.jsonl`,
    "github.com/ianlewis/todos",
    TODOS_VERSION,
    SLSA_VERIFIER_VERSION,
    SLSA_VERIFIER_SHA256SUM,
  );
  core.debug(`Setting ${todosPath} as executable`);
  await fs.chmod(todosPath, 0o700);

  core.debug(`Running git to get repository root`);
  const {
    exitCode: gitExitCode,
    stdout: gitOut,
    stderr: gitErr,
  } = await exec.getExecOutput("git", ["rev-parse", "--show-toplevel"], {
    cwd: wd,
  });
  core.debug(`Ran git rev-parse`);
  if (gitExitCode !== 0) {
    throw new ReopenError(
      `git exited ${gitExitCode}: ${gitErr}: is ${wd} in a git checkout?`,
    );
  }

  const repoRoot = gitOut.trim();

  core.debug(`Running todos (${todosPath})`);
  const { exitCode, stdout, stderr } = await exec.getExecOutput(
    todosPath,
    // Get the relative directory from the repsository root so that we have the
    // right paths to link to the files in generated issues.
    ["--output=json", path.relative(repoRoot, wd) || "."],
    {
      cwd: repoRoot,
      ignoreReturnCode: true,
    },
  );
  core.debug(`Ran todos (${todosPath})`);
  // NOTE: The exit code is 1 if there are TODOs and 0 if there are none.
  if (exitCode > 1) {
    throw new ReopenError(`todos exited ${exitCode}: ${stderr}`);
  }

  // Parse stdout into list of TODORef grouped by issue.
  const issueMap = new Map<number, TODOIssue>();
  for (let line of stdout.split("\n")) {
    line = line.trim();
    if (line === "") {
      continue;
    }
    const ref: TODORef = JSON.parse(line);

    const issueNum = matchLabel(ref.label, conf);
    if (Number.isNaN(issueNum) || issueNum <= 0) {
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
}

/**
 * reopenIssues is an async function that reopens issues linked to TODOs.
 * @param {TODOIssue[]} issues The issues and associate TODOs.
 * @param {string} token The GITHUB_TOKEN to authenticate with.
 * @param {boolean} dryRun true if running in dry-run mode.
 */
export async function reopenIssues(
  issues: TODOIssue[],
  token: string,
  dryRun: boolean,
): Promise<void> {
  const octokit = github.getOctokit(token, undefined, retry);

  const repo = github.context.repo;
  const sha = github.context.sha;

  for (const issueRef of issues) {
    if (issueRef.todos.length === 0) {
      continue;
    }

    let resp;
    try {
      resp = await octokit.rest.issues.get({
        owner: repo.owner,
        repo: repo.repo,
        issue_number: issueRef.issueID,
      });
    } catch (e) {
      const msg = String(e);
      core.warning(`error getting issue ${issueRef.issueID}: ${msg}`);
      continue;
    }

    const issue = resp.data;

    if (issue.state === "open") {
      continue;
    }

    let msgPrefix = "";
    if (dryRun) {
      msgPrefix = "[dry-run] ";
    }

    core.info(
      `${msgPrefix}Reopening https://github.com/${repo.owner}/${repo.repo}/issues/${issueRef.issueID} : ${issue.title}`,
    );

    if (dryRun) {
      continue;
    }

    // Reopen the issue.
    await octokit.rest.issues.update({
      owner: repo.owner,
      repo: repo.repo,
      issue_number: issueRef.issueID,
      state: "open",
    });

    // Remove the ref from the workflow ref as well as the repo and owner to
    // retrive just the path component.
    const workflowPath = (env.GITHUB_WORKFLOW_REF || "")
      .split("@")[0]
      .split("/")
      .slice(2)
      .join("/");

    let body = `This issue was reopened by the todo-issue-reopener action in the ["${env.GITHUB_WORKFLOW}"](https://github.com/${repo.owner}/${repo.repo}/blob/${sha}/${workflowPath}) GitHub Actions workflow because there are TODOs referencing this issue:\n`;
    for (const [i, todo] of issueRef.todos.entries()) {
      // NOTE: Get the path from the root of the repository.
      body += `${i + 1}. [${todo.path}:${todo.line}](https://github.com/${repo.owner}/${repo.repo}/blob/${sha}/${todo.path}#L${todo.line}): ${todo.message}\n`;
    }

    // Post the comment.
    await octokit.rest.issues.createComment({
      owner: repo.owner,
      repo: repo.repo,
      issue_number: issueRef.issueID,
      body,
    });
  }
}
