// SPDX-FileCopyrightText: 2026 Alexander Brichkin (Agonist Development AB)
// SPDX-License-Identifier: EUPL-1.2
//
// axe-core accessibility gate for /modules index and two representative module reports.
// Also checks for broken images on pages that embed screenshots.

import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "@playwright/test";

test("/modules index has zero axe-core WCAG A + AA violations", async ({
  page,
}) => {
  await page.goto("/modules");
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(
    results.violations,
    `axe violations on /modules:\n${JSON.stringify(results.violations, null, 2)}`,
  ).toEqual([]);
});

test("/modules index renders all six module cards", async ({ page }) => {
  await page.goto("/modules");
  const cards = page.locator(".module-card");
  await expect(cards).toHaveCount(6);
});

test("/modules index nav includes Modules link with aria-current", async ({
  page,
}) => {
  await page.goto("/modules");
  const link = page.locator("header nav a[href='/modules']");
  await expect(link).toHaveAttribute("aria-current", "page");
});

test("/modules/extension-panel/report.html has zero axe violations", async ({
  page,
}) => {
  await page.goto("/modules/extension-panel/report.html");
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(
    results.violations,
    `axe violations on extension-panel report:\n${JSON.stringify(results.violations, null, 2)}`,
  ).toEqual([]);
});

test("/modules/extension-panel/report.html has no broken images", async ({
  page,
}) => {
  await page.goto("/modules/extension-panel/report.html");
  await page.waitForLoadState("networkidle");
  const broken = await page.evaluate(() =>
    Array.from(document.images)
      .filter((img) => !img.complete || img.naturalWidth === 0)
      .map((img) => img.src),
  );
  expect(broken, `broken images: ${broken.join(", ")}`).toHaveLength(0);
});

test("/modules/web-demo/report.html has zero axe violations", async ({
  page,
}) => {
  await page.goto("/modules/web-demo/report.html");
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(
    results.violations,
    `axe violations on web-demo report:\n${JSON.stringify(results.violations, null, 2)}`,
  ).toEqual([]);
});

test("/modules/web-demo/report.html has no broken images", async ({
  page,
}) => {
  await page.goto("/modules/web-demo/report.html");
  await page.waitForLoadState("networkidle");
  const broken = await page.evaluate(() =>
    Array.from(document.images)
      .filter((img) => !img.complete || img.naturalWidth === 0)
      .map((img) => img.src),
  );
  expect(broken, `broken images: ${broken.join(", ")}`).toHaveLength(0);
});
