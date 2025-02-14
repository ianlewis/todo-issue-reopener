// Copyright 2025 Ian Lewis
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

import type * as core from "@actions/core";
import { jest } from "@jest/globals";

export type InputOptions = core.InputOptions;
export const debug = jest.fn<typeof core.debug>();
export const error = jest.fn<typeof core.error>();
export const info = jest.fn<typeof core.info>();
export const getInput = jest.fn<typeof core.getInput>();
export const setOutput = jest.fn<typeof core.setOutput>();
export const setFailed = jest.fn<typeof core.setFailed>();
export const warning = jest.fn<typeof core.warning>();
