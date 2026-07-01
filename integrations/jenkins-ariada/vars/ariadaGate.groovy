def call(Map config = [:]) {
  String targetUrl = (config.get('targetUrl') ?: env.ARIADA_TARGET_URL ?: '').toString()
  String outputDir = (config.get('outputDir') ?: 'ariada-output').toString()
  String cli = (config.get('cli') ?: env.ARIADA_CLI ?: 'ariada').toString()
  String format = (config.get('format') ?: 'both').toString()
  String threshold = (config.get('severityThreshold') ?: 'moderate').toString()
  String timeoutMs = (config.get('timeoutMs') ?: '30000').toString()
  boolean failBuild = config.containsKey('failBuild') ? config.failBuild as boolean : true
  boolean publishHtml = config.containsKey('publishHtml') ? config.publishHtml as boolean : true

  if (!targetUrl?.trim()) {
    error('ariadaGate requires targetUrl or ARIADA_TARGET_URL')
  }

  sh 'mkdir -p .ariada'
  writeFile(
    file: '.ariada/ariada-jenkins-gate.sh',
    text: libraryResource('org/ariada/jenkins/ariada-jenkins-gate.sh')
  )
  sh 'chmod +x .ariada/ariada-jenkins-gate.sh'

  int status = 0
  withEnv([
    "ARIADA_CLI=${cli}",
    "ARIADA_TARGET_URL=${targetUrl}",
    "ARIADA_OUTPUT_DIR=${outputDir}",
    "ARIADA_FORMAT=${format}",
    "ARIADA_SEVERITY_THRESHOLD=${threshold}",
    "ARIADA_TIMEOUT_MS=${timeoutMs}"
  ]) {
    status = sh(script: '.ariada/ariada-jenkins-gate.sh', returnStatus: true)
  }

  archiveArtifacts artifacts: "${outputDir}/**", allowEmptyArchive: true, fingerprint: true

  if (fileExists("${outputDir}/junit.xml")) {
    junit testResults: "${outputDir}/junit.xml", allowEmptyResults: true
  }

  if (publishHtml && fileExists("${outputDir}/result.html")) {
    publishHTML(target: [
      reportDir: outputDir,
      reportFiles: 'result.html',
      reportName: 'Ariada accessibility gate',
      keepAll: true,
      alwaysLinkToLastBuild: true,
      allowMissing: true
    ])
  }

  if (status != 0 && failBuild) {
    error("Ariada gate failed with exit code ${status}")
  }

  return status
}
