# Ariada Azure DevOps Extension

Thin Azure Pipelines task wrapping `ariada scan`. The task does not implement
scanner logic; it shells out to the Ariada CLI and publishes the output directory
as Azure Pipelines evidence.

## Local validation

```bash
node scripts/local-task-runner.mjs
node scripts/validate-extension.mjs
npx --yes tfx-cli extension create --manifest-globs vss-extension.json --output-path dist/ariada-azure-devops-extension.vsix
```

After browser screenshot capture:

```bash
node scripts/validate-evidence-links.mjs
```

## What is Azure DevOps?

Azure DevOps is Microsoft's development platform; this integration targets Azure
Pipelines tasks that run during build and release jobs.

## Why this is a separate Ariada channel

Azure Pipelines is a distinct enterprise CI surface from GitHub Actions, GitLab,
Jenkins, and Bitbucket. Microsoft-standardized organizations can install a
native task from the Visual Studio Marketplace instead of copy-pasting raw shell.

## Roles: who pays / what value they buy

| Role | Value |
|---|---|
| Engineering leaders | One CI gate that makes accessibility failures visible before release. |
| Compliance/procurement | Pipeline-attached evidence for EAA and EN 301 549 review. |
| Platform teams | Reusable task inputs that can be standardized across repositories. |

## Implemented vs not implemented

Implemented: `vss-extension.json`, `task/task.json`, Node task runner, local
task-runner fixture, HTML evidence reports, and local package validation.

Not implemented: live Marketplace publication, Azure DevOps organization share,
and live pipeline installation. Those require founder/account credentials.

## Sources

- Microsoft Learn, "Add a Custom Build or Release Task in an Extension":
  https://learn.microsoft.com/en-us/azure/devops/extend/develop/add-build-task
- Microsoft Learn, "Package and publish extensions":
  https://learn.microsoft.com/en-us/azure/devops/extend/publish/overview
- Microsoft Learn, "Azure Pipelines agents - Node.js runner versions":
  https://learn.microsoft.com/en-us/azure/devops/pipelines/agents/agents

Update:
- Author: Alexander Brichkin (Agonist Development AB)
- Date: 2026-07-01
