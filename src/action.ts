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

import { getInput, setFailed } from "@actions/core";

import { getTODOIssues, reopenIssues } from "./reopener";
import { readConfig } from "./config";

export async function runAction(): Promise<void> {
  const wd = getInput("path", { required: true });
  const token = getInput("token", { required: true });
  const dryRun = getInput("dry-run") === "true";
  const configPath = getInput("config-path", { required: true });

  const conf = await readConfig(configPath);

  try {
    const issues = await getTODOIssues(wd, conf);
    await reopenIssues(wd, issues, token, dryRun);
  } catch (err) {
    const message = err instanceof Error ? err.message : `${err}`;
    setFailed(message);
  }
}
