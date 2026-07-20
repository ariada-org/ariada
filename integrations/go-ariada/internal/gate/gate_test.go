// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

package gate

import (
	"bytes"
	"context"
	"os"
	"path/filepath"
	"reflect"
	"testing"
)

func TestRunBuildsAriadaScanCommandAndPassesWhenReportIsClean(t *testing.T) {
	dir := t.TempDir()
	runner := &fakeRunner{
		writeReport: `{"grid":{"http://127.0.0.1:8080/":{"accessibility":[]}}}`,
	}
	var stdout bytes.Buffer

	exitCode, err := Run(context.Background(), Options{
		TargetURL:          "http://127.0.0.1:8080/",
		OutputDir:          dir,
		Domains:            []string{"accessibility", "privacy"},
		SeverityThreshold:  "serious",
		CLICommand:         "ariada",
		Stdout:             &stdout,
	}, runner)
	if err != nil {
		t.Fatalf("Run returned error: %v", err)
	}
	if exitCode != ExitOK {
		t.Fatalf("exitCode = %d, want %d", exitCode, ExitOK)
	}

	wantArgs := []string{
		"scan", "http://127.0.0.1:8080/",
		"--format", "both",
		"--output-dir", dir,
		"--severity-threshold", "serious",
		"--domains", "accessibility,privacy",
	}
	if runner.name != "ariada" || !reflect.DeepEqual(runner.args, wantArgs) {
		t.Fatalf("runner command = %s %v, want ariada %v", runner.name, runner.args, wantArgs)
	}
	if !bytes.Contains(stdout.Bytes(), []byte("no findings at or above serious")) {
		t.Fatalf("stdout did not include clean summary: %s", stdout.String())
	}
}

func TestRunFailsWhenAriadaReportHasFindingsAtThreshold(t *testing.T) {
	dir := t.TempDir()
	runner := &fakeRunner{
		writeReport: `{"grid":{"http://127.0.0.1:8080/":{"accessibility":[{"severity":"minor"},{"severity":"moderate"},{"severity":"critical"}]}}}`,
	}
	var stdout bytes.Buffer

	exitCode, err := Run(context.Background(), Options{
		TargetURL:         "http://127.0.0.1:8080/",
		OutputDir:         dir,
		SeverityThreshold: "moderate",
		Stdout:            &stdout,
	}, runner)
	if err != nil {
		t.Fatalf("Run returned error: %v", err)
	}
	if exitCode != ExitViolations {
		t.Fatalf("exitCode = %d, want %d", exitCode, ExitViolations)
	}
	if !bytes.Contains(stdout.Bytes(), []byte("2 finding(s) at or above moderate")) {
		t.Fatalf("stdout did not include violation summary: %s", stdout.String())
	}
}

func TestRunRejectsInvalidInputs(t *testing.T) {
	tests := []struct {
		name string
		opts Options
	}{
		{
			name: "missing target",
			opts: Options{TargetURL: "", SeverityThreshold: "moderate"},
		},
		{
			name: "non-http target",
			opts: Options{TargetURL: "file:///tmp/index.html", SeverityThreshold: "moderate"},
		},
		{
			name: "bad threshold",
			opts: Options{TargetURL: "https://example.test/", SeverityThreshold: "blocker"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			exitCode, err := Run(context.Background(), tt.opts, &fakeRunner{})
			if err == nil {
				t.Fatal("Run returned nil error")
			}
			if exitCode != ExitInvalidArgs {
				t.Fatalf("exitCode = %d, want %d", exitCode, ExitInvalidArgs)
			}
		})
	}
}

func TestRunReturnsCliFailureWhenNoReportWasWritten(t *testing.T) {
	exitCode, err := Run(context.Background(), Options{
		TargetURL:         "https://example.test/",
		OutputDir:         t.TempDir(),
		SeverityThreshold: "moderate",
	}, &fakeRunner{result: Result{ExitCode: ExitRuntimeError, Err: os.ErrNotExist}})
	if err == nil {
		t.Fatal("Run returned nil error")
	}
	if exitCode != ExitRuntimeError {
		t.Fatalf("exitCode = %d, want %d", exitCode, ExitRuntimeError)
	}
}

func TestRunDoesNotTrustReportWhenCliFailsAtRuntime(t *testing.T) {
	exitCode, err := Run(context.Background(), Options{
		TargetURL:         "https://example.test/",
		OutputDir:         t.TempDir(),
		SeverityThreshold: "moderate",
	}, &fakeRunner{
		writeReport: `{"grid":{"https://example.test/":{"accessibility":[]}}}`,
		result:      Result{ExitCode: ExitRuntimeError, Err: os.ErrPermission},
	})
	if err == nil {
		t.Fatal("Run returned nil error")
	}
	if exitCode != ExitRuntimeError {
		t.Fatalf("exitCode = %d, want %d", exitCode, ExitRuntimeError)
	}
}

type fakeRunner struct {
	name        string
	args        []string
	writeReport string
	result      Result
}

func (f *fakeRunner) Run(_ context.Context, name string, args ...string) Result {
	f.name = name
	f.args = append([]string(nil), args...)
	if f.writeReport != "" {
		for i, arg := range args {
			if arg == "--output-dir" && i+1 < len(args) {
				if err := os.MkdirAll(args[i+1], 0o755); err != nil {
					return Result{ExitCode: ExitRuntimeError, Err: err}
				}
				path := filepath.Join(args[i+1], "multi-domain-report.json")
				if err := os.WriteFile(path, []byte(f.writeReport), 0o644); err != nil {
					return Result{ExitCode: ExitRuntimeError, Err: err}
				}
			}
		}
	}
	return f.result
}
