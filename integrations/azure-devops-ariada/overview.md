# Ariada Accessibility Gate for Azure DevOps

Run the Ariada CLI from Azure Pipelines and upload the scan output as pipeline
evidence.

```yaml
steps:
  - task: AriadaAccessibilityGate@0
    inputs:
      targetUrl: 'https://example.com'
      failOnSeverity: 'serious'
      outputDir: '$(Build.ArtifactStagingDirectory)/ariada-output'
      format: 'json'
```

Marketplace publication is intentionally not automated here. It requires a
founder-owned Visual Studio Marketplace publisher account and an Azure DevOps
organization where the private extension can be shared and installed.
