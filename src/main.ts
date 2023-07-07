import * as core from '@actions/core'
import * as github from '@actions/github'
import {run} from './run'

function mustGetInputOrEnv(inputName: string, envVar: string): string {
  const val = getInput(inputName, {required: false})
  if (val !== '') {
    return val
  }
  const env = process.env[envVar]
  if (env === undefined) {
    throw Error(`Neither input: ${inputName} nor env var ${envVar} are defined`)
  }
  return env
}

function getInput(
  name: string,
  options?: core.InputOptions,
  defaultValue?: string
): string {
  try {
    return core.getInput(name, options)
  } catch (ex) {
    if (defaultValue) {
      return defaultValue
    }
    throw ex
  }
}

function parseNewlineSeparatedStrings(input: string): string[] {
  if (input === '') {
    return []
  }
  return input.split(',').map(s => s.trim())
}

async function main(): Promise<void> {
  const {
    repo: {owner, repo}
  } = github.context
  try {
    await run({
      owner,
      repo,
      githubToken: mustGetInputOrEnv('access-token', 'GITHUB_TOKEN'),
      workflowID: Number(mustGetInputOrEnv('workflow-run-id', 'GITHUB_RUN_ID')),
      tag: getInput('tag', {required: true}, ''),
      dryRun: getInput('dry-run', {required: false}, '') === 'true',
      paths: parseNewlineSeparatedStrings(
        getInput('paths', {required: false}, '')
      )
    })
  } catch (error) {
    if (error instanceof Error) {
      core.error(
        error.stack ? `${error.message}:\n${error.stack}` : error.message
      )
      core.setFailed(error.message)
    }
  }
}

main()
