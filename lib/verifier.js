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
exports.downloadAndVerifySLSA = exports.VerificationError = exports.downloadSLSAVerifier = exports.validateFileDigest = exports.DigestValidationError = exports.FileError = void 0;
const crypto = __importStar(require("crypto"));
const fs = __importStar(require("fs/promises"));
const core = __importStar(require("@actions/core"));
const exec = __importStar(require("@actions/exec"));
const tc = __importStar(require("@actions/tool-cache"));
class FileError extends Error {
    constructor(filePath, message) {
        super(`${filePath}: ${message}`);
        // Set the prototype explicitly.
        Object.setPrototypeOf(this, FileError.prototype);
    }
}
exports.FileError = FileError;
class DigestValidationError extends Error {
    constructor(filePath, wantDigest, gotDigest) {
        super(`validation error for file ${filePath}: expected "${wantDigest}", got "${gotDigest}"`);
        // Set the prototype explicitly.
        Object.setPrototypeOf(this, DigestValidationError.prototype);
    }
}
exports.DigestValidationError = DigestValidationError;
// validateFileDigest validates a sha256 hex digest of the given file's contents
// against the expected digest. If a validation error occurs a DigestValidationError
// is thrown.
function validateFileDigest(filePath, expectedDigest) {
    return __awaiter(this, void 0, void 0, function* () {
        core.debug(`Validating file digest: ${filePath}`);
        core.debug(`Expected digest for ${filePath}: ${expectedDigest}`);
        let computedDigest;
        try {
            // Verify that the file exists.
            yield fs.access(filePath);
            const untrustedContents = yield fs.readFile(filePath);
            computedDigest = crypto
                .createHash("sha256")
                .update(untrustedContents)
                .digest("hex");
        }
        catch (err) {
            const message = err instanceof Error ? err.message : `${err}`;
            throw new FileError(filePath, message);
        }
        core.debug(`Computed digest for ${filePath}: ${computedDigest}`);
        if (computedDigest !== expectedDigest) {
            throw new DigestValidationError(filePath, expectedDigest, computedDigest);
        }
        core.debug(`Digest for ${filePath} validated`);
    });
}
exports.validateFileDigest = validateFileDigest;
// downloadSLSAVerifier downloads the slsa-verifier binary, verifies it against
// the expected sha256 hex digest, and returns the path to the binary.
function downloadSLSAVerifier(version, digest) {
    return __awaiter(this, void 0, void 0, function* () {
        core.debug(`Downloading slsa-verifier ${version}`);
        // Download the slsa-verifier binary.
        const verifierPath = yield tc.downloadTool(`https://github.com/slsa-framework/slsa-verifier/releases/download/${version}/slsa-verifier-linux-amd64`);
        core.debug(`Downloaded slsa-verifier to ${verifierPath}`);
        // Validate the checksum.
        yield validateFileDigest(verifierPath, digest);
        core.debug(`Setting ${verifierPath} as executable`);
        yield fs.chmod(verifierPath, 0o700);
        return verifierPath;
    });
}
exports.downloadSLSAVerifier = downloadSLSAVerifier;
class VerificationError extends Error {
    constructor(message) {
        super(`failed to verify binary provenance: ${message}`);
        // Set the prototype explicitly.
        Object.setPrototypeOf(this, VerificationError.prototype);
    }
}
exports.VerificationError = VerificationError;
// downloadAndVerifySLSA downloads a file and verifies the associated SLSA
// provenance.
function downloadAndVerifySLSA(url, provenanceURL, sourceURI, sourceTag, slsaVerifierVersion, slsaVerifierDigest) {
    return __awaiter(this, void 0, void 0, function* () {
        const verifierPromise = downloadSLSAVerifier(slsaVerifierVersion, slsaVerifierDigest);
        core.debug(`Downloading ${url}`);
        const artifactPromise = tc.downloadTool(url);
        core.debug(`Downloading ${provenanceURL}`);
        const provenancePromise = tc.downloadTool(provenanceURL);
        const verifierPath = yield verifierPromise;
        const artifactPath = yield artifactPromise;
        core.debug(`Downloaded ${url} to ${artifactPath}`);
        const provenancePath = yield provenancePromise;
        core.debug(`Downloaded ${provenanceURL} to ${provenancePath}`);
        core.debug(`Running slsa-verifier (${verifierPath})`);
        const { exitCode, stdout, stderr } = yield exec.getExecOutput(verifierPath, [
            "verify-artifact",
            artifactPath,
            "--provenance-path",
            provenancePath,
            "--source-uri",
            sourceURI,
            "--source-tag",
            sourceTag,
        ], { ignoreReturnCode: true });
        core.debug(`Ran slsa-verifier (${verifierPath}): ${stdout}`);
        if (exitCode !== 0) {
            throw new VerificationError(`slsa-verifier exited ${exitCode}: ${stderr}`);
        }
        return artifactPath;
    });
}
exports.downloadAndVerifySLSA = downloadAndVerifySLSA;
