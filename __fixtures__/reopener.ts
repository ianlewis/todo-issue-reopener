import reopener from '../src/reopener.js'
import type * as reopener_types from '../src/reopener.js'
import { jest } from '@jest/globals'

export const ReopenError = reopener.ReopenError
export const TODORef = reopener.TODORef
export const matchLabel = reopener.matchLabel
export const getTODOIssues = jest.fn<typeof reopener_types.getTODOIssues>()
export const reopenIssues = jest.fn<typeof reopener_types.reopenIssues>()


export default {
  ReopenError,
  TODORef,

  matchLabel,
  getTODOIssues,
  reopenIssues,
}
