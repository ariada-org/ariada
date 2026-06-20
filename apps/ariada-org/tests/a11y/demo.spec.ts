// SPDX-FileCopyrightText: 2026 Alexander Brichkin (Agonist Development AB)
// SPDX-License-Identifier: EUPL-1.2
//
// axe-core Phase 1 accessibility gate for the /demo route.
// Asserts zero WCAG 2.x A + AA violations on the rendered static page.
// Wires the Phase 1 gate from the accessible-design skill into CI.

import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "@playwright/test";

test("/demo has zero axe-core WCAG A + AA violations", async ({ page }) => {
  await page.goto("/demo");
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(
    results.violations,
    `axe violations on /demo:\n${JSON.stringify(results.violations, null, 2)}`,
  ).toEqual([]);
});

test("/demo score headline is visible", async ({ page }) => {
  await page.goto("/demo");
  // Each site column should show a numeric score
  const scoreNumbers = page.locator(".mdc-score-number");
  const count = await scoreNumbers.count();
  expect(count).toBeGreaterThan(0);
  // Verify scores are numeric 0-100
  for (let i = 0; i < count; i++) {
    const text = await scoreNumbers.nth(i).textContent();
    const n = parseInt(text ?? "", 10);
    expect(n).toBeGreaterThanOrEqual(0);
    expect(n).toBeLessThanOrEqual(100);
  }
});

test("/demo finding detail expands via native details element", async ({
  page,
}) => {
  await page.goto("/demo");
  // There should be at least one details element for findings
  const details = page.locator(".mdc-findings");
  const count = await details.count();
  expect(count).toBeGreaterThan(0);
  // Open the first one
  const toggle = details.first().locator("summary");
  await toggle.click();
  // After clicking, the details should be open
  await expect(details.first()).toHaveAttribute("open");
  // Regulatory badges should be visible
  const badges = details.first().locator(".mdc-reg-badge");
  await expect(badges.first()).toBeVisible();
});

test("/demo cross-domain interaction panel always rendered", async ({
  page,
}) => {
  await page.goto("/demo");
  const section = page.locator("#mdc-interactions-heading");
  await expect(section).toBeVisible();
});

test("/demo cross-site divergence panel always rendered", async ({ page }) => {
  await page.goto("/demo");
  const section = page.locator("#mdc-divergence-heading");
  await expect(section).toBeVisible();
});

test("/demo nav touch targets meet 44px minimum (WCAG 2.5.5)", async ({
  page,
}) => {
  await page.goto("/demo");
  const navLinks = page.locator("header[role='banner'] nav a");
  const count = await navLinks.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i++) {
    const box = await navLinks.nth(i).boundingBox();
    expect(
      box?.height,
      `nav link ${i} height should be ≥44px`,
    ).toBeGreaterThanOrEqual(44);
  }
});
