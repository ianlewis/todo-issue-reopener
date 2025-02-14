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

// See: https://jestjs.io/docs/configuration

/** @type {import('ts-jest').JestConfigWithTsJest} **/
export default {
  clearMocks: true,
  collectCoverage: true,
  collectCoverageFrom: ["./src/**"],
  coverageDirectory: "./coverage",
  coveragePathIgnorePatterns: ["/node_modules/", "/dist/"],
  coverageReporters: ["json-summary", "text", "lcov"],
  extensionsToTreatAsEsm: [".ts"],
  moduleFileExtensions: ["ts", "js"],
  preset: "ts-jest",
  reporters: ["default"],
  resolver: "ts-jest-resolver",
  testEnvironment: "node",
  testMatch: ["**/*.test.ts"],
  testPathIgnorePatterns: ["/dist/", "/node_modules/"],
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        tsconfig: "tsconfig.eslint.json",
        useESM: true,
      },
    ],
  },
  verbose: true,
};
