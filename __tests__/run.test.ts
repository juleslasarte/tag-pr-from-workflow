import * as core from '@actions/core'
import * as github from '@actions/github'
import {components} from '@octokit/openapi-types'
import {run, RunOpts} from '../src/run' // Replace 'your-module' with the actual module name
import {mock} from 'node:test'

// Mocking the core module
jest.mock('@actions/core')
const mockedCore = core as jest.Mocked<typeof core>

// Mock the methods of core.summary
mockedCore.summary.addHeading = jest.fn().mockReturnThis()
mockedCore.summary.addTable = jest.fn().mockReturnThis()
mockedCore.summary.write = jest.fn().mockResolvedValue(undefined)

// Mocking the github module
jest.mock('@actions/github')
const mockedGithub = github as jest.Mocked<typeof github>

jest.mock('minimatch', () => ({
  minimatch: jest.fn().mockReturnValue(true)
}))

// Mocking the octokit object
const mockedOctokit = {
  rest: {
    repos: {
      get: jest.fn(),
      listPullRequestsAssociatedWithCommit: jest.fn(),
      compareCommits: jest.fn(),
      getCommit: jest.fn()
    },
    actions: {
      getWorkflowRun: jest.fn(),
      listWorkflowRuns: jest.fn()
    },
    issues: {
      update: jest.fn()
    }
  }
} as any
mockedGithub.getOctokit.mockReturnValue(mockedOctokit)

describe('run', () => {
  const opts: RunOpts = {
    owner: 'your-owner',
    repo: 'your-repo',
    githubToken: 'your-token',
    workflowID: 1234,
    tag: 'your-tag',
    dryRun: false,
    paths: ['path/to/your/file']
  }

  beforeEach(() => {
    // Clear all mock function calls and return values before each test
    jest.clearAllMocks()
  })

  test('should update pull request with a new tag', async () => {
    const repoInfo = {
      data: {
        default_branch: 'main'
      }
    }
    mockedOctokit.rest.repos.get.mockResolvedValue(repoInfo)

    const workflow = {
      head_commit: {
        id: 'commit-id'
      },
      workflow_id: 1234
    }
    mockedOctokit.rest.actions.getWorkflowRun.mockResolvedValue({
      data: workflow
    })

    const pullRequest = {
      number: 123,
      url: 'https://github.com/your-owner/your-repo/pull/123',
      labels: []
    }
    mockedOctokit.rest.repos.listPullRequestsAssociatedWithCommit.mockResolvedValue(
      {
        data: [pullRequest]
      }
    )

    const mockedPullRequestData = {
      url: 'https://api.github.com/repos/owner/repo/pulls/123',
      id: 123456789
      // Other properties...
    }

    // Mock the response of `issues.update` method
    mockedOctokit.rest.issues.update.mockResolvedValue({
      status: 200,
      data: mockedPullRequestData
    })

    const completedWorkflowRuns = {
      data: {
        workflow_runs: [
          {
            id: 12345,
            head_sha: 'last-commit-id'
          },
          {
            id: 12346,
            head_sha: 'last-commit-id'
          }
        ]
      }
    }
    mockedOctokit.rest.actions.listWorkflowRuns.mockResolvedValue(
      completedWorkflowRuns
    )

    const commitsComparison = {
      data: {
        commits: [
          {
            sha: 'commit-id'
          }
        ]
      }
    }
    mockedOctokit.rest.repos.compareCommits.mockResolvedValue(commitsComparison)

    const commitFiles = {
      data: {
        files: [
          {
            filename: 'path/to/your/file'
          }
        ]
      }
    }
    mockedOctokit.rest.repos.getCommit.mockResolvedValue(commitFiles)

    await run(opts)

    expect(mockedOctokit.rest.issues.update).toHaveBeenCalledWith({
      owner: opts.owner,
      repo: opts.repo,
      issue_number: pullRequest.number,
      labels: [opts.tag]
    })

    expect(mockedCore.info).toHaveBeenCalledWith(
      `Successfully tagged pull request ${pullRequest.url} with ${opts.tag}`
    )

    // Check that the correct methods were called to get the workflow runs, compare commits, and get commit
    expect(mockedOctokit.rest.actions.listWorkflowRuns).toHaveBeenCalledWith({
      owner: opts.owner,
      repo: opts.repo,
      workflow_id: String(workflow.workflow_id),
      branch: 'main',
      status: 'success',
      per_page: 10
    })

    expect(mockedOctokit.rest.repos.compareCommits).toHaveBeenCalledWith({
      owner: opts.owner,
      repo: opts.repo,
      base: 'last-commit-id',
      head: workflow.head_commit.id
    })

    expect(mockedOctokit.rest.repos.getCommit).toHaveBeenCalledWith({
      owner: opts.owner,
      repo: opts.repo,
      ref: 'commit-id'
    })
  })

  test('should handle no pull request found for the commit', async () => {
    const repoInfo = {
      data: {
        default_branch: 'main'
      }
    }
    mockedOctokit.rest.repos.get.mockResolvedValue(repoInfo)

    const workflow = {
      head_commit: {
        id: 'commit-id'
      }
    }
    mockedOctokit.rest.actions.getWorkflowRun.mockResolvedValue({
      data: workflow
    })

    mockedOctokit.rest.repos.listPullRequestsAssociatedWithCommit.mockResolvedValue(
      {
        data: []
      }
    )

    await run(opts)

    expect(mockedOctokit.rest.issues.update).not.toHaveBeenCalled()

    expect(mockedCore.info).toHaveBeenCalledWith(
      `No pull request found for commit ${workflow.head_commit.id}`
    )
  })

  test('should handle dry run mode', async () => {
    const repoInfo = {
      data: {
        default_branch: 'main'
      }
    }
    mockedOctokit.rest.repos.get.mockResolvedValue(repoInfo)

    const workflow = {
      head_commit: {
        id: 'commit-id'
      }
    }
    mockedOctokit.rest.actions.getWorkflowRun.mockResolvedValue({
      data: workflow
    })

    const pullRequest = {
      number: 123,
      url: 'https://github.com/your-owner/your-repo/pull/123',
      labels: []
    }
    mockedOctokit.rest.repos.listPullRequestsAssociatedWithCommit.mockResolvedValue(
      {
        data: [pullRequest]
      }
    )

    const dryRunOpts = {...opts, dryRun: true}

    await run(dryRunOpts)

    expect(mockedOctokit.rest.issues.update).not.toHaveBeenCalled()

    expect(mockedCore.info).toHaveBeenCalledWith(
      `Dry run: tagged pull request ${pullRequest.url} with ${opts.tag}`
    )
  })
})
