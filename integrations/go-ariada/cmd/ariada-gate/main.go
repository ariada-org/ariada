// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

package main

import (
	"context"
	"flag"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/ariada-org/ariada/integrations/go-ariada/internal/gate"
)

func main() {
	var (
		target            = flag.String("url", "", "HTTP(S) URL to scan")
		outputDir         = flag.String("output-dir", "ariada-output", "directory for Ariada JSON artifacts")
		domains           = flag.String("domains", "", "comma-separated Ariada domains to scan")
		severityThreshold = flag.String("severity-threshold", "moderate", "minimum severity that fails the gate")
		cliCommand        = flag.String("ariada-bin", getenv("ARIADA_BIN", "ariada"), "Ariada CLI binary to execute")
		timeout           = flag.Duration("timeout", 2*time.Minute, "overall scan timeout")
	)
	flag.Parse()

	if *target == "" && flag.NArg() > 0 {
		*target = flag.Arg(0)
	}

	opts := gate.Options{
		TargetURL:          *target,
		OutputDir:          *outputDir,
		Domains:            splitCSV(*domains),
		SeverityThreshold:  *severityThreshold,
		CLICommand:         *cliCommand,
		Stdout:             os.Stdout,
		Stderr:             os.Stderr,
	}

	ctx, cancel := context.WithTimeout(context.Background(), *timeout)
	defer cancel()

	exitCode, err := gate.Run(ctx, opts, gate.ExecRunner{})
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
	}
	os.Exit(exitCode)
}

func splitCSV(value string) []string {
	if value == "" {
		return nil
	}
	parts := strings.Split(value, ",")
	out := make([]string, 0, len(parts))
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part != "" {
			out = append(out, part)
		}
	}
	return out
}

func getenv(name, fallback string) string {
	value := os.Getenv(name)
	if value == "" {
		return fallback
	}
	return value
}
