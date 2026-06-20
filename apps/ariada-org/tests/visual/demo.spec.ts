// SPDX-FileCopyrightText: 2026 Alexander Brichkin (Agonist Development AB)
// SPDX-License-Identifier: EUPL-1.2
//
// Visual regression tests for the /demo route.
// Component-scoped snapshots for: compliance grid, interaction panel,
// divergence panel, score headlines, and finding detail drill-down.
// Baselines stored in tests/snapshots/. Run with --update-snapshots to
// capture new baselines; CI runs without the flag to detect regressions.

import { test, expect } from "@playwright/test";

test.describe("demo page visual regression", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/demo");
    // Ensure page is fully settled before capturing
    await page.waitForLoadState("networkidle");
  });

  test("full page — desktop 1280px light", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(page).toHaveScreenshot("demo-desktop-1280-light.png", {
      fullPage: true,
      animations: "disabled",
    });
  });

  test("full page — mobile 375px light", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await expect(page).toHaveScreenshot("demo-mobile-375-light.png", {
      fullPage: true,
      animations: "disabled",
    });
  });

  test("compliance grid with score headlines", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const grid = page.locator(".mdc-table-wrapper").first();
    await expect(grid).toHaveScreenshot("demo-grid-score-headlines.png", {
      animations: "disabled",
    });
  });

  test("finding detail expanded — first cell with findings", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    // Open the first finding details
    const toggle = page.locator(".mdc-findings-toggle").first();
    await toggle.click();
    await page.locator(".mdc-finding").first().waitFor({ state: "visible" });
    const cell = page.locator(".mdc-cell").first();
    await expect(cell).toHaveScreenshot("demo-finding-expanded.png", {
      animations: "disabled",
    });
  });

  test("cross-domain interaction panel", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    // Use getByRole with the section's accessible name to avoid matching parent sections
    const section = page.getByRole("region", { name: "Cross-domain interactions" });
    await expect(section).toHaveScreenshot("demo-interaction-panel.png", {
      animations: "disabled",
    });
  });

  test("cross-site divergence panel", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const section = page.getByRole("region", { name: "Cross-site divergences" });
    await expect(section).toHaveScreenshot("demo-divergence-panel.png", {
      animations: "disabled",
    });
  });
});
