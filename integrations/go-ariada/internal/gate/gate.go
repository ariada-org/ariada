// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

package gate

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/url"
	"os"
	"path/filepath"
	"strings"
)

const (
	ExitOK = 0
	ExitViolations = 1
	ExitInvalidArgs = 2
	ExitRuntimeError = 3
)

type Options struct {
	TargetURL string
	OutputDir string
	Domains []string
	SeverityThreshold string
	CLICommand string
	Stdout io.Writer
	Stderr io.Writer
}

type Runner interface {
	Run(ctx context.Context, name string, args...string) Result
}

type Result struct {
	Stdout string
	Stderr string
	ExitCode int
	Err error
}

func Run(ctx context.Context, opts Options, runner Runner) (int, error) {
	if opts.Stdout == nil {
 opts.Stdout = io.Discard
	}
	if opts.Stderr == nil {
 opts.Stderr = io.Discard
	}
	if opts.CLICommand == "" {
 opts.CLICommand = "ariada"
	}
	if opts.OutputDir == "" {
 opts.OutputDir = "ariada-output"
	}
	if opts.SeverityThreshold == "" {
 opts.SeverityThreshold = "moderate"
	}
	if !validURL(opts.TargetURL) {
 return ExitInvalidArgs, fmt.Errorf("provide a parseable http(s) URL with -url or as the first argument")
	}
	if _, ok:= severityRank(opts.SeverityThreshold); !ok {
 return ExitInvalidArgs, fmt.Errorf("unknown severity threshold %q", opts.SeverityThreshold)
	}
	if err:= os.MkdirAll(opts.OutputDir, 0o755); err != nil {
 return ExitRuntimeError, fmt.Errorf("create output dir: %w", err)
	}

	args:= []string{
 "scan", opts.TargetURL,
 "--format", "both",
 "--output-dir", opts.OutputDir,
 "--severity-threshold", opts.SeverityThreshold,
	}
	if len(opts.Domains) > 0 {
 args = append(args, "--domains", strings.Join(opts.Domains, ","))
	}

	result:= runner.Run(ctx, opts.CLICommand, args...)
	if result.Stdout != "" {
 fmt.Fprint(opts.Stdout, result.Stdout)
	}
	if result.Stderr != "" {
 fmt.Fprint(opts.Stderr, result.Stderr)
	}
	if result.ExitCode != ExitOK && result.ExitCode != ExitViolations {
 return normalizeExitCode(result.ExitCode), result.Err
	}

	report, parseErr:= readReport(filepath.Join(opts.OutputDir, "multi-domain-report.json"))
	if parseErr != nil {
 if result.ExitCode != ExitOK {
 return normalizeExitCode(result.ExitCode), result.Err
 }
 return ExitRuntimeError, parseErr
	}

	findings:= report.FindingsAtOrAbove(opts.SeverityThreshold)
	if findings > 0 {
 fmt.Fprintf(opts.Stdout, "\nariada-gate: %d finding(s) at or above %s\n", findings, opts.SeverityThreshold)
 return ExitViolations, nil
	}
	fmt.Fprintf(opts.Stdout, "\nariada-gate: no findings at or above %s\n", opts.SeverityThreshold)
	return ExitOK, nil
}

func validURL(value string) bool {
	parsed, err:= url.Parse(value)
	return err == nil && (parsed.Scheme == "http" || parsed.Scheme == "https") && parsed.Host != ""
}

func normalizeExitCode(code int) int {
	if code >= ExitOK && code <= ExitRuntimeError {
 return code
	}
	return ExitRuntimeError
}

func readReport(path string) (multiDomainReport, error) {
	raw, err:= os.ReadFile(path)
	if err != nil {
 return multiDomainReport{}, fmt.Errorf("read Ariada report %s: %w", path, err)
	}
	var report multiDomainReport
	if err:= json.Unmarshal(raw, &report); err != nil {
 return multiDomainReport{}, fmt.Errorf("parse Ariada report %s: %w", path, err)
	}
	if len(report.Grid) == 0 {
 return multiDomainReport{}, errors.New("Ariada report has no grid")
	}
	return report, nil
}

type finding struct {
	Severity string `json:"severity"`
}

type multiDomainReport struct {
	Grid map[string]map[string][]finding `json:"grid"`
}

func (r multiDomainReport) FindingsAtOrAbove(threshold string) int {
	minRank, _:= severityRank(threshold)
	count:= 0
	for _, byDomain:= range r.Grid {
 for _, findings:= range byDomain {
 for _, item:= range findings {
 rank, ok:= severityRank(item.Severity)
 if !ok {
 rank, _ = severityRank("moderate")
 }
 if rank >= minRank {
 count++
 }
 }
 }
	}
	return count
}

func severityRank(value string) (int, bool) {
	switch value {
	case "minor":
 return 1, true
	case "moderate":
 return 2, true
	case "serious":
 return 3, true
	case "critical":
 return 4, true
	default:
 return 0, false
	}
}
