import verifier from '../src/verifier.js'
import type * as verifier_types from '../src/verifier.js'
import { jest } from '@jest/globals'

export const FileError = verifier.FileError
export const DigestValidationError = verifier.DigestValidationError
export const VerificationError = verifier.VerificationError
export const validateFileDigest = jest.fn<typeof verifier_types.validateFileDigest>()
export const downloadSLSAVerifier = jest.fn<typeof verifier_types.downloadSLSAVerifier>()
export const downloadAndVerifySLSA = jest.fn<typeof verifier_types.downloadAndVerifySLSA>()


export default {
  FileError,
  DigestValidationError,
  VerificationError,

validateFileDigest,
downloadSLSAVerifier,
downloadAndVerifySLSA,
}
