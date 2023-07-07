import * as core from '@actions/core'
import * as github from '@actions/github'
/* eslint-disable  import/no-unresolved */
import {components} from '@octokit/openapi-types'
import {minimatch} from 'minimatch'
import {SummaryTableRow} from '@actions/core/lib/summary'

export type workflowRunStatus = components['parameters']['workflow-run-status']

export interface RunOpts {
  owner: string
  repo: string
  githubToken: string
  workflowID: number
  tag: string
  dryRun: boolean
  paths: string[]
}

export async function run(opts: RunOpts): Promise<void> {
  const {owner, repo, paths, githubToken, workflowID, tag, dryRun} = opts
  const prs = []
  // Initialize octokit with the provided GitHub token
  const octokit = github.getOctokit(githubToken)

  // Fetch workflow run data
  const {data: workflow} = await octokit.rest.actions.getWorkflowRun({
    owner,
    repo,
    run_id: workflowID
  })

  // Fetch repository data
  const repoInfo = await octokit.rest.repos.get({owner, repo})
  const defaultBranch = repoInfo.data.default_branch

  if (workflow.head_commit) {
    // Fetch pull requests associated with the commit
    const response =
      await octokit.rest.repos.listPullRequestsAssociatedWithCommit({
        owner,
        repo,
        commit_sha: workflow.head_commit.id
      })

    if (response.data.length > 0) {
      // Update labels for the first pull request associated with the commit
      await updatePullRequestLabels(
        octokit,
        owner,
        repo,
        response.data[0],
        tag,
        dryRun
      )
      prs.push(response.data[0])
    } else {
      core.info(`No pull request found for commit ${workflow.head_commit.id}`)
    }

    // Fetch workflow runs for the repository
    const completed = await octokit.rest.actions.listWorkflowRuns({
      owner,
      repo,
      workflow_id: String(workflow.workflow_id),
      branch: workflow.head_branch ?? defaultBranch,
      status: 'success',
      per_page: 10
    })

    // Filter out workflow runs that are marked as complete
    const previouslyCompleted = completed.data.workflow_runs.filter(
      w => w.id !== workflowID
    )

    let lastCommit = ''
    let previouslyCompletedWorkflowRun = 0
    if (previouslyCompleted.length > 0) {
      const [first] = previouslyCompleted
      lastCommit = first.head_sha
      previouslyCompletedWorkflowRun = first.id
      core.info(
        `Last successfully completed workflow run: ${first.id} for commit: ${lastCommit}`
      )
    }

    // Fetch comparison between commits
    const commits = await octokit.rest.repos.compareCommits({
      owner,
      repo,
      base: lastCommit,
      head: workflow.head_commit.id
    })

    core.info(
      `Found ${commits.data.commits.length} commmits in between run ${previouslyCompletedWorkflowRun} and ${workflowID}} -- filtering based on paths ${paths}`
    )
    const filteredCommits: string[] = []
    // Filter commits based on paths
    if (opts.paths.length > 0) {
      for (const commitSha of commits.data.commits) {
        const commit = await octokit.rest.repos.getCommit({
          owner,
          repo,
          ref: commitSha.sha
        })
        if (commit.data.files) {
          const commitFiles = commit.data.files.map(file => file.filename)
          for (const path of paths) {
            if (commitFiles.some(file => minimatch(file, path))) {
              filteredCommits.push(commitSha.sha)
              break
            }
          }
        }
      }
    }

    // Update labels for pull requests associated with the filtered commits
    for (const sha of filteredCommits) {
      const listPRResponse =
        await octokit.rest.repos.listPullRequestsAssociatedWithCommit({
          owner,
          repo,
          commit_sha: sha
        })

      if (listPRResponse.data.length > 0) {
        // Update labels for the first pull request associated with the commit
        await updatePullRequestLabels(
          octokit,
          owner,
          repo,
          listPRResponse.data[0],
          tag,
          dryRun
        )
        prs.push(listPRResponse.data[0])
      }
    }
  }
  const rows: SummaryTableRow[] = []

  for (const pr of prs) {
    rows.push([
      `https://github.com/${owner}/${repo}/pull/${pr.number}`,
      pr.user?.login ?? ''
    ])
  }

  await core.summary
    .addHeading('PRs in this run :rocket:')
    .addTable([
      [
        {data: 'PR', header: true},
        {data: 'Author', header: true}
      ],
      ...rows
    ])
    .write()
}

// Function to update labels of a pull request
async function updatePullRequestLabels(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string,
  pullRequest: {number: number; labels: {name: string}[]; url: string},
  tag: string,
  dryRun: boolean
): Promise<void> {
  // Get the existing labels of the pull request
  const currentLabels = pullRequest.labels.map(label => label.name)
  // Add the new tag to the existing labels
  const updatedLabels = [...currentLabels, tag]

  if (!dryRun) {
    const updatedPullRequest = await octokit.rest.issues.update({
      owner,
      repo,
      issue_number: pullRequest.number,
      labels: updatedLabels
    })
    if (updatedPullRequest.status === 200) {
      core.info(
        `Successfully tagged pull request https://github.com/${owner}/${repo}/pull/${pullRequest.number} with ${tag}`
      )
    } else {
      // Handle the case when the update request was not successful
      core.warning('Failed to update pull request with the new tag')
    }
  } else {
    core.info(
      `Dry run: tagged pull request https://github.com/${owner}/${repo}/pull/${pullRequest.number} with ${tag}`
    )
  }
}
