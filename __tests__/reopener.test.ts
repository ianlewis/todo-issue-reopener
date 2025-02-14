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

import { jest } from "@jest/globals";

import fs from "fs";
import os from "os";
import path from "path";

import * as core from "../__fixtures__/core.js";
import * as exec from "../__fixtures__/exec.js";
import * as github from "../__fixtures__/github.js";
import * as tc from "../__fixtures__/tool-cache.js";
import * as verifier from "../__fixtures__/verifier.js";

jest.unstable_mockModule("@actions/core", () => core);
jest.unstable_mockModule("@actions/exec", () => exec);
jest.unstable_mockModule("@actions/github", () => github);
jest.unstable_mockModule("@actions/tool-cache", () => tc);
jest.unstable_mockModule("../src/verifier.js", () => verifier);

const reopener = await import("../src/reopener.js");

describe("TODORef", () => {
  it("constructs", async () => {
    const ref = new reopener.TODORef();
    expect(ref.path).toBe("");
    expect(ref.type).toBe("");
    expect(ref.text).toBe("");
    expect(ref.label).toBe("");
    expect(ref.message).toBe("");
    expect(ref.line).toBe(0);
    expect(ref.comment_line).toBe(0);
  });
});

describe("getTODOIssues", () => {
  const env = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...env };
    process.env.GITHUB_WORKSPACE = "/home/user";

    github.context.repo = {
      owner: "owner",
      repo: "repo",
    };

    github.context.sha = "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef";
  });

  it("parses empty output", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "getTODOIssues_"));
    const todosPath = path.join(tmpDir, "todos");
    fs.writeFileSync(todosPath, "");

    verifier.downloadAndVerifySLSA.mockResolvedValueOnce(todosPath);

    const workspacePath = process.env.GITHUB_WORKSPACE as string;

    // git rev-parse --show-top-level
    exec.getExecOutput.mockResolvedValueOnce({
      exitCode: 0,
      stdout: `${workspacePath}\n`,
      stderr: "",
    });

    // todos
    exec.getExecOutput.mockResolvedValueOnce({
      exitCode: 0,
      stdout: "",
      stderr: "",
    });

    await expect(
      reopener.getTODOIssues(workspacePath, {}),
    ).resolves.toHaveLength(0);
  });

  it("skips non-match", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "getTODOIssues_"));
    const todosPath = path.join(tmpDir, "todos");
    fs.writeFileSync(todosPath, "");

    verifier.downloadAndVerifySLSA.mockResolvedValueOnce(todosPath);

    const workspacePath = process.env.GITHUB_WORKSPACE as string;

    // git rev-parse --show-top-level
    exec.getExecOutput.mockResolvedValueOnce({
      exitCode: 0,
      stdout: `${workspacePath}\n`,
      stderr: "",
    });

    // todos
    exec.getExecOutput.mockResolvedValueOnce({
      exitCode: 0,
      stdout: '{"label": "ianlewis"}',
      stderr: "",
    });

    await expect(
      reopener.getTODOIssues(workspacePath, {}),
    ).resolves.toHaveLength(0);
  });

  it("skips links to other repos", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "getTODOIssues_"));
    const todosPath = path.join(tmpDir, "todos");
    fs.writeFileSync(todosPath, "");

    verifier.downloadAndVerifySLSA.mockResolvedValueOnce(todosPath);

    const workspacePath = process.env.GITHUB_WORKSPACE as string;

    // git rev-parse --show-top-level
    exec.getExecOutput.mockResolvedValueOnce({
      exitCode: 0,
      stdout: `${workspacePath}\n`,
      stderr: "",
    });

    // todos
    exec.getExecOutput.mockResolvedValueOnce({
      exitCode: 0,
      stdout: '{"label": "github.com/octocat/repo/issues/123"}',
      stderr: "",
    });

    await expect(
      reopener.getTODOIssues(workspacePath, {}),
    ).resolves.toHaveLength(0);
  });

  it("handles malformed url", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "getTODOIssues_"));
    const todosPath = path.join(tmpDir, "todos");
    fs.writeFileSync(todosPath, "");

    verifier.downloadAndVerifySLSA.mockResolvedValueOnce(todosPath);

    const workspacePath = process.env.GITHUB_WORKSPACE as string;

    // git rev-parse --show-top-level
    exec.getExecOutput.mockResolvedValueOnce({
      exitCode: 0,
      stdout: `${workspacePath}\n`,
      stderr: "",
    });

    // todos
    exec.getExecOutput.mockResolvedValueOnce({
      exitCode: 0,
      stdout: '{"label": "github.com//repo/issues/123"}',
      stderr: "",
    });

    await expect(
      reopener.getTODOIssues(workspacePath, {}),
    ).resolves.toHaveLength(0);
  });

  it("matches issue number only", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "getTODOIssues_"));
    const todosPath = path.join(tmpDir, "todos");
    fs.writeFileSync(todosPath, "");

    verifier.downloadAndVerifySLSA.mockResolvedValueOnce(todosPath);

    const workspacePath = process.env.GITHUB_WORKSPACE as string;

    // git rev-parse --show-top-level
    exec.getExecOutput.mockResolvedValueOnce({
      exitCode: 0,
      stdout: `${workspacePath}\n`,
      stderr: "",
    });

    // todos
    exec.getExecOutput.mockResolvedValueOnce({
      exitCode: 0,
      stdout: '{"label": "123"}',
      stderr: "",
    });

    const p = reopener.getTODOIssues(workspacePath, {});
    await expect(p).resolves.toHaveLength(1);
    const issues = await p;

    expect(issues[0].todos).toHaveLength(1);
    expect(issues[0].issueID).toBe(123);
    expect(issues[0].todos[0].label).toBe("123");
  });

  it("matches issue number with #", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "getTODOIssues_"));
    const todosPath = path.join(tmpDir, "todos");
    fs.writeFileSync(todosPath, "");

    verifier.downloadAndVerifySLSA.mockResolvedValueOnce(todosPath);

    const workspacePath = process.env.GITHUB_WORKSPACE as string;

    // git rev-parse --show-top-level
    exec.getExecOutput.mockResolvedValueOnce({
      exitCode: 0,
      stdout: `${workspacePath}\n`,
      stderr: "",
    });

    // todos
    exec.getExecOutput.mockResolvedValueOnce({
      exitCode: 0,
      stdout: '{"label": "#123"}',
      stderr: "",
    });

    const p = reopener.getTODOIssues(workspacePath, {});
    await expect(p).resolves.toHaveLength(1);
    const issues = await p;

    expect(issues[0].todos).toHaveLength(1);
    expect(issues[0].issueID).toBe(123);
    expect(issues[0].todos[0].label).toBe("#123");
  });

  it("matches issue url", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "getTODOIssues_"));
    const todosPath = path.join(tmpDir, "todos");
    fs.writeFileSync(todosPath, "");

    verifier.downloadAndVerifySLSA.mockResolvedValueOnce(todosPath);

    const workspacePath = process.env.GITHUB_WORKSPACE as string;

    // git rev-parse --show-top-level
    exec.getExecOutput.mockResolvedValueOnce({
      exitCode: 0,
      stdout: `${workspacePath}\n`,
      stderr: "",
    });

    // todos
    exec.getExecOutput.mockResolvedValueOnce({
      exitCode: 0,
      stdout: '{"label": "github.com/owner/repo/issues/123"}',
      stderr: "",
    });

    const p = reopener.getTODOIssues(workspacePath, {});
    await expect(p).resolves.toHaveLength(1);
    const issues = await p;

    expect(issues[0].todos).toHaveLength(1);
    expect(issues[0].issueID).toBe(123);
    expect(issues[0].todos[0].label).toBe("github.com/owner/repo/issues/123");
  });

  it("groups todo", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "getTODOIssues_"));
    const todosPath = path.join(tmpDir, "todos");
    fs.writeFileSync(todosPath, "");

    verifier.downloadAndVerifySLSA.mockResolvedValueOnce(todosPath);

    const workspacePath = process.env.GITHUB_WORKSPACE as string;

    // git rev-parse --show-top-level
    exec.getExecOutput.mockResolvedValueOnce({
      exitCode: 0,
      stdout: `${workspacePath}\n`,
      stderr: "",
    });

    // todos
    exec.getExecOutput.mockResolvedValueOnce({
      exitCode: 0,
      stdout: '{"label": "123"}\n{"label": "456"}\n{"label": "123"}',
      stderr: "",
    });

    const p = reopener.getTODOIssues(workspacePath, {});
    await expect(p).resolves.toHaveLength(2);
    const issues = await p;

    const issue123 = issues.find((i) => i.issueID === 123);
    expect(issue123).toBeDefined();
    expect(issue123!.todos).toHaveLength(2);

    const issue456 = issues.find((i) => i.issueID === 456);
    expect(issue456).toBeDefined();
    expect(issue456!.todos).toHaveLength(1);
  });

  it("handles todos error", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "getTODOIssues_"));
    const todosPath = path.join(tmpDir, "todos");
    fs.writeFileSync(todosPath, "");

    verifier.downloadAndVerifySLSA.mockResolvedValueOnce(todosPath);

    const workspacePath = process.env.GITHUB_WORKSPACE as string;

    // git rev-parse --show-top-level
    exec.getExecOutput.mockResolvedValueOnce({
      exitCode: 0,
      stdout: `${workspacePath}\n`,
      stderr: "",
    });

    // todos
    exec.getExecOutput.mockResolvedValueOnce({
      // NOTE: todos returns exit code
      exitCode: 1,
      stdout: "",
      stderr: "ERROR",
    });

    await expect(
      reopener.getTODOIssues(workspacePath, {}),
    ).rejects.toBeInstanceOf(reopener.ReopenError);
  });

  it("handles checkout in sub-dir", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "getTODOIssues_"));
    const todosPath = path.join(tmpDir, "todos");
    fs.writeFileSync(todosPath, "");

    verifier.downloadAndVerifySLSA.mockResolvedValueOnce(todosPath);

    const workspacePath = process.env.GITHUB_WORKSPACE as string;
    const repoRoot = path.join(workspacePath, "checkout");

    // git rev-parse --show-top-level
    exec.getExecOutput.mockResolvedValueOnce({
      exitCode: 0,
      stdout: `${repoRoot}\n`,
      stderr: "",
    });

    // todos
    exec.getExecOutput.mockResolvedValueOnce({
      exitCode: 0,
      stdout: '{"path": "path/to/file.js", "label": "#123"}',
      stderr: "",
    });

    await expect(
      reopener.getTODOIssues(path.join(repoRoot, "path/to"), {}),
    ).resolves.toHaveLength(1);

    expect(exec.getExecOutput).toHaveBeenLastCalledWith(
      todosPath,
      ["--output=json", "path/to"],
      {
        cwd: repoRoot,
        ignoreReturnCode: true,
      },
    );
  });

  it("handles path not in git repo", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "getTODOIssues_"));
    const todosPath = path.join(tmpDir, "todos");
    fs.writeFileSync(todosPath, "");

    verifier.downloadAndVerifySLSA.mockResolvedValueOnce(todosPath);

    const workspacePath = process.env.GITHUB_WORKSPACE as string;
    const repoRoot = path.join(workspacePath, "checkout");

    // git rev-parse --show-top-level
    exec.getExecOutput.mockResolvedValueOnce({
      exitCode: 128,
      stdout: "",
      stderr:
        "fatal: not a git repository (or any of the parent directories): .git\n",
    });

    // todos
    exec.getExecOutput.mockResolvedValueOnce({
      exitCode: 0,
      stdout: '{"path": "path/to/file.js", "label": "#123"}',
      stderr: "",
    });

    await expect(
      reopener.getTODOIssues(path.join(repoRoot, "path/to"), {}),
    ).rejects.toBeInstanceOf(reopener.ReopenError);
  });
});

describe("reopenIssues", () => {
  const env = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...env };
    process.env.GITHUB_WORKSPACE = "/home/user";
  });

  it("handles empty list", async () => {
    const issues = {
      get: jest.fn(),
      createComment: jest.fn(),
      update: jest.fn(),
    };
    github.getOctokit.mockImplementation(() => {
      return {
        rest: { issues },
      };
    });

    await expect(
      reopener.reopenIssues([], "", false),
    ).resolves.toBeUndefined();

    expect(issues.get).not.toHaveBeenCalled();
    expect(issues.createComment).not.toHaveBeenCalled();
    expect(issues.update).not.toHaveBeenCalled();
  });

  it("handles empty todo refs", async () => {
    const issues = {
      get: jest.fn(),
      createComment: jest.fn(),
      update: jest.fn(),
    };
    github.getOctokit.mockImplementation(() => {
      return {
        rest: { issues },
      };
    });

    // NOTE: todoIssue.todos is empty.
    const todoIssue = new reopener.TODOIssue(123);

    await expect(
      reopener.reopenIssues([todoIssue], "", false),
    ).resolves.toBeUndefined();

    expect(issues.get).not.toHaveBeenCalled();
    expect(issues.createComment).not.toHaveBeenCalled();
    expect(issues.update).not.toHaveBeenCalled();
  });

  it("handles non-existing issue", async () => {
    const issues = {
      get: jest.fn().mockImplementation(() => {
        throw new Error("Not Found");
      }),
      createComment: jest.fn(),
      update: jest.fn(),
    };
    github.getOctokit.mockImplementation(() => {
      return {
        rest: { issues },
      };
    });

    const todoIssue = new reopener.TODOIssue(123);
    todoIssue.todos.push(new reopener.TODORef());

    await expect(
      reopener.reopenIssues([todoIssue], "", false),
    ).resolves.toBeUndefined();

    expect(issues.get).toHaveBeenCalled();
    expect(issues.createComment).not.toHaveBeenCalled();
    expect(issues.update).not.toHaveBeenCalled();
  });

  it("handles open issue", async () => {
    const issues = {
      get: jest.fn().mockImplementation(() => {
        return {
          data: {
            state: "open",
          },
        };
      }),
      createComment: jest.fn(),
      update: jest.fn(),
    };
    github.getOctokit.mockImplementation(() => {
      return {
        rest: { issues },
      };
    });

    const todoIssue = new reopener.TODOIssue(123);
    todoIssue.todos.push(new reopener.TODORef());

    await expect(
      reopener.reopenIssues([todoIssue], "", false),
    ).resolves.toBeUndefined();

    expect(issues.get).toHaveBeenCalledTimes(1);
    expect(issues.createComment).not.toHaveBeenCalled();
    expect(issues.update).not.toHaveBeenCalled();
  });

  it("reopens closed issue", async () => {
    const issues = {
      get: jest.fn().mockImplementation(() => {
        return {
          data: {
            state: "closed",
          },
        };
      }),
      createComment: jest.fn(),
      update: jest.fn(),
    };
    github.getOctokit.mockImplementation(() => {
      return {
        rest: { issues },
      };
    });

    const todoIssue = new reopener.TODOIssue(123);
    // NOTE: multiple TODO references.
    todoIssue.todos.push(new reopener.TODORef());
    todoIssue.todos.push(new reopener.TODORef());

    await expect(
      reopener.reopenIssues([todoIssue], "", false),
    ).resolves.toBeUndefined();

    expect(issues.get).toHaveBeenCalledTimes(1);
    expect(issues.createComment).toHaveBeenCalledTimes(1);
    expect(issues.update).toHaveBeenCalledTimes(1);
  });

  it("reopens closed issue dry-run", async () => {
    const issues = {
      get: jest.fn().mockImplementation(() => {
        return {
          data: {
            state: "closed",
          },
        };
      }),
      createComment: jest.fn(),
      update: jest.fn(),
    };
    github.getOctokit.mockImplementation(() => {
      return {
        rest: { issues },
      };
    });

    const todoIssue = new reopener.TODOIssue(123);
    // NOTE: multiple TODO references.
    todoIssue.todos.push(new reopener.TODORef());
    todoIssue.todos.push(new reopener.TODORef());

    await expect(
      // NOTE: dry-run = true
      reopener.reopenIssues([todoIssue], "", true),
    ).resolves.toBeUndefined();

    expect(issues.get).toHaveBeenCalledTimes(1);
    expect(issues.createComment).not.toHaveBeenCalled();
    expect(issues.update).not.toHaveBeenCalled();
  });

  it("reopens multiple closed issues", async () => {
    const issues = {
      get: jest.fn().mockImplementation(() => {
        return {
          data: {
            state: "closed",
          },
        };
      }),
      createComment: jest.fn(),
      update: jest.fn(),
    };
    github.getOctokit.mockImplementation(() => {
      return {
        rest: { issues },
      };
    });

    const todoIssue1 = new reopener.TODOIssue(123);
    todoIssue1.todos.push(new reopener.TODORef());
    todoIssue1.todos.push(new reopener.TODORef());

    const todoIssue2 = new reopener.TODOIssue(456);
    todoIssue2.todos.push(new reopener.TODORef());

    await expect(
      reopener.reopenIssues([todoIssue1, todoIssue2], "", false),
    ).resolves.toBeUndefined();

    expect(issues.get).toHaveBeenCalledTimes(2);
    expect(issues.createComment).toHaveBeenCalledTimes(2);

    expect(issues.update).toHaveBeenCalledTimes(2);
  });
});

describe("labelMatch", () => {
  it("github url", async () => {
    const num = reopener.matchLabel(
      "https://github.com/owner/repo/issues/123",
      {},
    );
    expect(num).toBe(123);
  });

  it("github url with spaces", async () => {
    const num = reopener.matchLabel(
      " \thttps://github.com/owner/repo/issues/123  ",
      {},
    );
    expect(num).toBe(123);
  });

  it("github url no scheme", async () => {
    const num = reopener.matchLabel("github.com/owner/repo/issues/123", {});
    expect(num).toBe(123);
  });

  it("github url different repo", async () => {
    const num = reopener.matchLabel("github.com/owner/other/issues/123", {});
    expect(num).toBe(-1);
  });

  it("github url different repo", async () => {
    const num = reopener.matchLabel("github.com/owner/other/issues/123", {});
    expect(num).toBe(-1);
  });

  it("num only", async () => {
    const num = reopener.matchLabel("123", {});
    expect(num).toBe(123);
  });

  it("num with #", async () => {
    const num = reopener.matchLabel("#123", {});
    expect(num).toBe(123);
  });

  it("no match", async () => {
    const num = reopener.matchLabel("no match", {});
    expect(num).toBe(-1);
  });

  it("vanity url", async () => {
    const num = reopener.matchLabel("golang.org/issues/123", {
      vanityURLs: ["^golang.org/issues/(?<id>[0-9]+)$"],
    });
    expect(num).toBe(123);
  });

  it("vanity url no match", async () => {
    const num = reopener.matchLabel("golang.org/issues", {
      vanityURLs: ["^golang.org/issues/(?<id>[0-9]+)$"],
    });
    expect(num).toBe(-1);
  });

  it("vanity url error", async () => {
    const num = reopener.matchLabel("golang.org/issues/123", {
      vanityURLs: ["^golang.org/issues/(?<id>[0-9]+$"],
    });
    expect(num).toBe(-1);
  });
});
