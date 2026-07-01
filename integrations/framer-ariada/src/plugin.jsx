import { framer } from "@framer/plugin"
import React, { useState } from "react"
import { createRoot } from "react-dom/client"

import { auditFramerCanvas } from "./framer-adapter.cjs"

function Plugin() {
  const [status, setStatus] = useState("Select a frame or open a page, then run Ariada.")
  const [issues, setIssues] = useState([])

  async function runAudit() {
    setStatus("Scanning current Framer canvas context...")
    try {
      const result = await auditFramerCanvas(framer)
      setIssues(result.issues)
      setStatus(`Ariada checked ${result.scannedNodes} node(s) and found ${result.issues.length} issue(s).`)
      framer.notify?.(`Ariada found ${result.issues.length} issue(s).`)
    } catch (error) {
      setIssues([])
      setStatus(error instanceof Error ? error.message : "Ariada could not scan this Framer context.")
    }
  }

  return (
    <main className="app">
      <header>
        <h1>Ariada Accessibility Check</h1>
        <p>Design-time contrast, target-size, and text-alternative checks for the current Framer frame or page.</p>
      </header>
      <button type="button" onClick={runAudit}>Run scan</button>
      <p role="status">{status}</p>
      <ol aria-label="Ariada issues">
        {issues.map((issue) => (
          <li key={issue.id}>
            <strong>{issue.rule}</strong>
            <span>{issue.nodeName}</span>
            <p>{issue.message} {issue.remediation}</p>
          </li>
        ))}
      </ol>
    </main>
  )
}

framer.showUI?.({ width: 360, height: 520 })

createRoot(document.getElementById("root")).render(<Plugin />)
