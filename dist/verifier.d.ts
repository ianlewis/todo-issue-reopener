export declare class FileError extends Error {
    constructor(filePath: string, message: string);
}
export declare class DigestValidationError extends Error {
    constructor(filePath: string, wantDigest: string, gotDigest: string);
}
export declare function validateFileDigest(filePath: string, expectedDigest: string): Promise<void>;
export declare function downloadSLSAVerifier(version: string, digest: string): Promise<string>;
export declare class VerificationError extends Error {
    constructor(message: string);
}
export declare function downloadAndVerifySLSA(url: string, provenanceURL: string, sourceURI: string, sourceTag: string, slsaVerifierVersion: string, slsaVerifierDigest: string): Promise<string>;
declare const _default: {
    FileError: typeof FileError;
    DigestValidationError: typeof DigestValidationError;
    VerificationError: typeof VerificationError;
    validateFileDigest: typeof validateFileDigest;
    downloadSLSAVerifier: typeof downloadSLSAVerifier;
    downloadAndVerifySLSA: typeof downloadAndVerifySLSA;
};
export default _default;
