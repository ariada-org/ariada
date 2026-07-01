# Ariada Jenkins Shared Library

This directory implements S31 as a Jenkins Pipeline shared library instead of a
full HPI plugin. The S31 handoff allows this lighter form, and it is the
smallest useful Jenkins-native channel: a Pipeline step wraps the Ariada CLI
gate, then archives HTML, JSON, and JUnit-style artifacts. It does not re-create
scanner logic.

## What is included

- `vars/ariadaGate.groovy` exposes the `ariadaGate(...)` Pipeline step.
- `resources/org/ariada/jenkins/ariada-jenkins-gate.sh` invokes `ariada scan`.
- `fixtures/Jenkinsfile` shows the shared-library call shape.
- `scripts/run-fixture.mjs` runs the same shell wrapper locally with a fixture
  Ariada CLI and generates reviewer evidence.
- `test-report/result.html` and `scan-evidence/result.html` are generated local
  evidence artifacts.

## Jenkins usage

```groovy
@Library('ariada-jenkins') _

pipeline {
  agent any
  stages {
    stage('Ariada accessibility gate') {
      steps {
        ariadaGate(
          targetUrl: 'https://example.com',
          outputDir: 'ariada-output',
          severityThreshold: 'moderate'
        )
      }
    }
  }
}
```

The agent must have `ariada` on `PATH`, or pass `cli: '/path/to/ariada'`.

## Local evidence

```bash
node integrations/jenkins-ariada/scripts/run-fixture.mjs
node integrations/jenkins-ariada/scripts/validate-report-links.mjs
```

The fixture CLI exists only to prove the wrapper flow without requiring a live
Jenkins controller or network scan target. Production Jenkins jobs call
`@ariada-org/cli`.

## Blockers

Live Jenkins validation and Jenkins Plugin Index publishing require a Jenkins
controller, shared-library hosting, credentials, and release governance. Those
are founder/operator steps outside this local scaffold.

## Update

- Author: TURING (orchestrator)
- Date: 2026-07-01
