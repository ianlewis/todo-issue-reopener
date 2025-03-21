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

import * as core from "@actions/core";

import * as reopener from "./reopener.js";
import * as config from "./config.js";

/**
 * runAction is an async function that runs the full GitHub action.
 */
export async function runAction(): Promise<void> {
  const wd = core.getInput("path", { required: true });
  const token = core.getInput("token", { required: true });
  const dryRun = core.getInput("dry-run") === "true";
  const configPath = core.getInput("config-path", { required: true });

  const conf = await config.readConfig(configPath);

  try {
    const issues = await reopener.getTODOIssues(wd, conf);
    await reopener.reopenIssues(issues, token, dryRun);
  } catch (err) {
    const message = err instanceof Error ? err.message : `${err}`;
    core.setFailed(message);
  }
}
