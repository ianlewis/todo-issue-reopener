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

import * as core from "../__fixtures__/core.js";
import * as reopener from "../__fixtures__/reopener.js";

// Mocks should be declared before the module being tested is imported.
jest.unstable_mockModule("@actions/core", () => core);
jest.unstable_mockModule("../src/reopener.js", () => reopener);

const action = await import("../src/action.js");

describe("runAction", () => {
  const env = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...env };
  });

  afterEach(() => {
    process.env = env;
  });

  it("runs reopener", async () => {
    reopener.getTODOIssues.mockResolvedValueOnce([]);
    reopener.reopenIssues.mockResolvedValueOnce(undefined);

    const workspacePath = "/home/user";
    const githubToken = "deadbeef";
    const configPath = ".todos.yml";
    const dryRun = false;

    core.getInput.mockImplementation(
      (name: string, _options?: core.InputOptions): string => {
        switch (name) {
          case "path":
            return workspacePath;
            break;
          case "token":
            return githubToken;
            break;
          case "config-path":
            return configPath;
            break;
          case "dry-run":
            return String(dryRun);
            break;
        }
        return "";
      },
    );

    await action.runAction();

    expect(reopener.getTODOIssues).toBeCalledWith(workspacePath, {});
    expect(reopener.reopenIssues).toBeCalledWith(
      workspacePath,
      [],
      githubToken,
      dryRun,
    );

    expect(core.setFailed).not.toHaveBeenCalled();
  });

  it("handles getTODOIssues failure", async () => {
    const errMsg = "test error";
    reopener.getTODOIssues.mockRejectedValueOnce(new Error(errMsg));

    const workspacePath = "/home/user";
    const githubToken = "deadbeef";
    const configPath = ".todos.yml";
    const dryRun = false;

    core.getInput.mockImplementation(
      (name: string, _options?: core.InputOptions): string => {
        switch (name) {
          case "path":
            return workspacePath;
            break;
          case "token":
            return githubToken;
            break;
          case "config-path":
            return configPath;
            break;
          case "dry-run":
            return String(dryRun);
            break;
        }
        return "";
      },
    );

    await action.runAction();

    expect(reopener.getTODOIssues).toBeCalledWith(workspacePath, {});
    expect(reopener.reopenIssues).not.toHaveBeenCalled();

    expect(core.setFailed).toBeCalledWith(errMsg);
  });

  it("handles reopenIssues failure", async () => {
    const errMsg = "test error";
    reopener.getTODOIssues.mockResolvedValueOnce([]);
    reopener.reopenIssues.mockRejectedValueOnce(new Error(errMsg));

    const workspacePath = "/home/user";
    const githubToken = "deadbeef";
    const configPath = ".todos.yml";
    const dryRun = false;

    core.getInput.mockImplementation(
      (name: string, _options?: core.InputOptions): string => {
        switch (name) {
          case "path":
            return workspacePath;
            break;
          case "token":
            return githubToken;
            break;
          case "config-path":
            return configPath;
            break;
          case "dry-run":
            return String(dryRun);
            break;
        }
        return "";
      },
    );

    await action.runAction();

    expect(reopener.getTODOIssues).toBeCalledWith(workspacePath, {});
    expect(reopener.reopenIssues).toBeCalledWith(
      workspacePath,
      [],
      githubToken,
      dryRun,
    );

    expect(core.setFailed).toBeCalledWith(errMsg);
  });
});
