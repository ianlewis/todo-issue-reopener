import { jest } from '@jest/globals'

export const getOctokit = jest.fn()
export const context = {
    repo: {
      owner: "",
      repo: "",
    },
    sha: "",
}
