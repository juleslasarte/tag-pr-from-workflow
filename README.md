<p align="center">
  <a href="https://github.com/actions/typescript-action/actions"><img alt="typescript-action status" src="https://github.com/actions/typescript-action/workflows/build-test/badge.svg"></a>
</p>

# GitHub Action: Tag Pull Request from Workflow

This GitHub Action allows you to automatically tag pull requests based on workflow runs. It retrieves the workflow run information, fetches the associated pull request(s), and adds the specified tag to the pull request(s). This can be useful for automating labeling or categorizing pull requests based on specific criteria.

## Usage

To use this action, you can include the following step in your workflow file:

```yaml
name: Tag Pull Request
on:
  workflow_run:
    types:
      - completed

jobs:
  tag-pull-request:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout Repository
        uses: actions/checkout@v2

      - name: Tag Pull Request
        uses: your-username/tag-pr-from-workflow@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          workflow-id: ${{ github.event.workflow_run.id }}
          tag: "automated-tag"
          dry-run: false
          paths: |
            backend/lib/cellular-control-plane/**
            backend/config/central-accounts/**
            backend/functions/cellular-control-plane/**
            backend/lib/common/**
            backend/config/pagerduty/**
            backend/functions/common/**
            backend/functions/go.*
            backend/bin/**
            backend/Makefile
```

This action runs whenever a workflow run completes. It checks the associated pull request(s) for the specified commit and updates the pull request(s) by adding the provided tag. The `github-token` input is required and should be provided as the `GITHUB_TOKEN` secret.

## Inputs

- `github-token` (required): The GitHub token used to authenticate API requests. It should be provided as `${{ secrets.GITHUB_TOKEN }}`.
- `workflow-id` (required): The ID of the workflow run. It can be accessed using `${{ github.event.workflow_run.id }}`.
- `tag` (required): The tag to be added to the pull request(s).
- `dry-run` (optional): If set to `true`, the action will only simulate the tag update without actually modifying the pull request(s). Default is `false`.
- `paths` (optional): A newline-separated list of paths used to filter the commits and pull requests. Only the pull requests associated with commits that touch any of the specified paths will be updated with the tag.

## License

This project is licensed under the [MIT License](LICENSE).
