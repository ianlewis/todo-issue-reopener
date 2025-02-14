import type * as exec from '@actions/exec'
import { jest } from '@jest/globals'

export const getExecOutput = jest.fn<typeof exec.getExecOutput>()
