import * as core from '@actions/core';
import * as github from '@actions/github';
import { components } from '@octokit/openapi-types';
import { run, RunOpts } from '../src/run'; // Replace 'your-module' with the actual module name

// Mocking the core module
jest.mock('@actions/core');
const mockedCore = core as jest.Mocked<typeof core>;

// Mocking the github module
jest.mock('@actions/github');
const mockedGithub = github as jest.Mocked<typeof github>;

// Mocking the octokit object
const mockedOctokit = {
  rest: {
    repos: {
      get: jest.fn(),
      listPullRequestsAssociatedWithCommit: jest.fn(),
    },
    actions: {
      getWorkflowRun: jest.fn(),
    },
    issues: {
      update: jest.fn(),
    },
  },
} as any;
mockedGithub.getOctokit.mockReturnValue(mockedOctokit);

describe('run', () => {
  const opts: RunOpts = {
    owner: 'your-owner',
    repo: 'your-repo',
    githubToken: 'your-token',
    workflowID: 1234,
    tag: 'your-tag',
    dryRun: false,
  };

  beforeEach(() => {
    // Clear all mock function calls and return values before each test
    jest.clearAllMocks();
  });

  test('should update pull request with a new tag', async () => {
    const repoInfo = {
      data: {
        default_branch: 'main',
      },
    };
    mockedOctokit.rest.repos.get.mockResolvedValue(repoInfo);

    const workflow = {
      head_commit: {
        id: 'commit-id',
      },
    };
    mockedOctokit.rest.actions.getWorkflowRun.mockResolvedValue({ data: workflow });

    const pullRequest = {
      number: 123,
      url: 'https://github.com/your-owner/your-repo/pull/123',
      labels: [],
    };
    mockedOctokit.rest.repos.listPullRequestsAssociatedWithCommit.mockResolvedValue({
      data: [pullRequest],
    });

    const mockedPullRequestData = {
      url: 'https://api.github.com/repos/owner/repo/pulls/123',
      id: 123456789,
      // Other properties...
    };
    
    // Mock the response of `issues.update` method
    mockedOctokit.rest.issues.update.mockResolvedValue({
      status: 200,
      data: mockedPullRequestData,
    });

    await run(opts);

    expect(mockedOctokit.rest.issues.update).toHaveBeenCalledWith({
      owner: opts.owner,
      repo: opts.repo,
      issue_number: pullRequest.number,
      labels: [opts.tag],
    });

    expect(mockedCore.info).toHaveBeenCalledWith(
      `Successfully tagged pull request ${pullRequest.url} with ${opts.tag}`
    );
  });

  test('should handle no pull request found for the commit', async () => {
    const repoInfo = {
      data: {
        default_branch: 'main',
      },
    };
    mockedOctokit.rest.repos.get.mockResolvedValue(repoInfo);

    const workflow = {
      head_commit: {
        id: 'commit-id',
      },
    };
    mockedOctokit.rest.actions.getWorkflowRun.mockResolvedValue({ data: workflow });

    mockedOctokit.rest.repos.listPullRequestsAssociatedWithCommit.mockResolvedValue({
      data: [],
    });

    await run(opts);

    expect(mockedOctokit.rest.issues.update).not.toHaveBeenCalled();

    expect(mockedCore.info).toHaveBeenCalledWith(
      `No pull request found for commit ${workflow.head_commit.id}`
    );
  });

  test('should handle dry run mode', async () => {
    const repoInfo = {
      data: {
        default_branch: 'main',
      },
    };
    mockedOctokit.rest.repos.get.mockResolvedValue(repoInfo);

    const workflow = {
      head_commit: {
        id: 'commit-id',
      },
    };
    mockedOctokit.rest.actions.getWorkflowRun.mockResolvedValue({ data: workflow });

    const pullRequest = {
      number: 123,
      url: 'https://github.com/your-owner/your-repo/pull/123',
      labels: [],
    };
    mockedOctokit.rest.repos.listPullRequestsAssociatedWithCommit.mockResolvedValue({
      data: [pullRequest],
    });

    const dryRunOpts = { ...opts, dryRun: true };

    await run(dryRunOpts);

    expect(mockedOctokit.rest.issues.update).not.toHaveBeenCalled();

    expect(mockedCore.info).toHaveBeenCalledWith(
      `Dry run: tagged pull request ${pullRequest.url} with ${opts.tag}`
    );
  });
});
