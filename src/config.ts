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

import * as core from "@actions/core";

import YAML from "yaml";

/**
 * Config represents the parsed config file.
 */
export interface Config {
  /**
   * vanityURLs is a list of regex strings to match against vanity issue URLs.
   */ 
  vanityURLs?: string[];
}

/**
 * readConfig is an async function that reads the config.yml file at the given
 * path and return the parsed Config object.
 * @param {string} configPath The path to the configuration file.
 * @returns {Promise<Config>} The parsed config object.
 */
export async function readConfig(configPath: string): Promise<Config> {
  let contents: string;
  try {
    contents = await fs.readFile(configPath, { encoding: "utf8" });
  } catch (err) {
    core.debug(`error reading "${configPath}": ${err}`);
    return {};
  }

  const config: Config = YAML.parse(contents);
  if (!config) {
    return {};
  }
  return config;
}

export default {
  readConfig,
};
