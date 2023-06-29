import * as core from '@actions/core';
import * as github from '@actions/github';
/* eslint-disable  import/no-unresolved */
import { components } from '@octokit/openapi-types';

export type workflowRunStatus = components['parameters']['workflow-run-status'];

export interface RunOpts {
  owner: string;
  repo: string;
  githubToken: string;
  workflowID: number;
  tag: string; 
  dryRun: boolean;
}

export async function run(opts: RunOpts): Promise<void> {
  const { owner, repo } = opts;

  const octokit = github.getOctokit(opts.githubToken);

  const repoInfo = await octokit.rest.repos.get({ owner, repo });
  const defaultBranch = repoInfo.data.default_branch;

  const { data: workflow } = await octokit.rest.actions.getWorkflowRun({
    owner,
    repo,
    run_id: opts.workflowID
  });
  const branch = workflow.head_branch ?? defaultBranch;
  if (workflow.head_commit) {
    
    const response = await octokit.rest.repos.listPullRequestsAssociatedWithCommit({
      owner,
      repo,
      commit_sha: workflow.head_commit.id
    });

    if (response.data.length > 0) {
      // Add a comment to the corresponding pull request
      const pullRequest = response.data[0]
      if (pullRequest) {
        if (!opts.dryRun) {
          core.info(`Tagging pull request ${pullRequest.url} with ${opts.tag}`);

          // Get the existing labels of the pull request
          const currentLabels = pullRequest.labels.map(label => label.name);
           // Add the new tag to the existing labels
          const updatedLabels = [...currentLabels, opts.tag];

          const updatedPullRequest = await octokit.rest.issues.update({
            owner,
            repo,
            issue_number: pullRequest.number,
            labels: updatedLabels,
          });
          core.info(`Tagging operation result: ${JSON.stringify(updatedPullRequest.data)}`);
        } else {
          core.info(`Dry run: tagged pull request ${pullRequest.url} with ${opts.tag}`);
        }
      } else {
        core.info(`No pull request found for commit ${workflow.head_commit.id}`);
      }
    }
  }
}
