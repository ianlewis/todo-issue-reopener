import * as tc from '@actions/tool-cache'
import type * as tc_types from '@actions/tool-cache'
import { jest } from '@jest/globals'

export const HTTPError = tc.HTTPError
export type HTTPError = tc.HTTPError
export const downloadTool = jest.fn<typeof tc_types.downloadTool>()
