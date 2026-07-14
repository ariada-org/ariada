// SPDX-FileCopyrightText: 2026 Alexander Brichkin (Agonist Development AB)
// SPDX-License-Identifier: EUPL-1.2
//
// Accessibility, evidence, runtime, and route coverage for the 236-module catalog.

import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "@playwright/test";

const axeTags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

test("/modules has zero axe-core WCAG A + AA violations", async ({ page }) => {
  await page.goto("/modules/");
  const results = await new AxeBuilder({ page }).withTags(axeTags).analyze();
  expect(
    results.violations,
    "axe violations on /modules/:\n" + JSON.stringify(results.violations, null, 2),
  ).toEqual([]);
});

test("/modules renders 236 rows with 236 unique detail routes", async ({
  page,
  request,
}) => {
  const indexResponse = await page.goto("/modules/");
  expect(indexResponse?.status()).toBe(200);
  const geoTier = indexResponse?.headers()["x-geo-tier"];
  expect(geoTier).toMatch(/^(?:tier1|tier2|tier3|denied)$/);
  const rows = page.locator("tbody tr");
  await expect(rows).toHaveCount(236);

  const s2Row = page.locator('tbody tr[data-channel-id="S2"]');
  await expect(s2Row).toHaveCount(1);
  await expect(s2Row.getByRole("link", { name: /^Delivery [12]$/ })).toHaveCount(2);
  await expect(s2Row.locator('[data-evidence-kind="production"]')).toHaveCount(0);
  await expect(s2Row.getByRole("link", { name: "Production", exact: true })).toHaveCount(0);
  await expect(s2Row).not.toContainText("Production");

  const hrefs = await rows.locator("td:nth-child(2) > a").evaluateAll((links) =>
    links.map((link) => link.getAttribute("href")),
  );
  expect(hrefs).toHaveLength(236);
  expect(new Set(hrefs).size).toBe(236);
  expect(hrefs).toContain("/modules/s1/");
  expect(hrefs).toContain("/modules/s236/");
  expect(
    hrefs.every((href) =>
      /^\/modules\/s(?:[1-9]|[1-9]\d|1\d\d|2[0-2]\d|23[0-6])\/$/.test(href ?? ""),
    ),
  ).toBe(true);

  const responses = await Promise.all(
    hrefs.map((href) => request.get(href as string)),
  );
  const failures = responses
    .map((response, index) => ({ href: hrefs[index], status: response.status() }))
    .filter(({ status }) => status !== 200);
  expect(
    failures,
    "detail route failures: " + JSON.stringify(failures),
  ).toEqual([]);
  const middlewareFailures = responses
    .map((response, index) => ({
      href: hrefs[index],
      geoTier: response.headers()["x-geo-tier"],
    }))
    .filter((response) => response.geoTier !== geoTier);
  expect(
    middlewareFailures,
    "detail routes missing Pages Functions evidence: "
      + JSON.stringify(middlewareFailures),
  ).toEqual([]);
});

test("/modules has no executable runtime scripts or polling", async ({ page }) => {
  await page.goto("/modules/");
  await expect(page.locator('script:not([type="application/ld+json"])')).toHaveCount(0);
  const html = await page.content();
  expect(html).not.toContain("setInterval");
  expect(html).not.toContain("fetch(");
  expect(html).toContain("Verified build snapshot");
});

test("/modules/s2 renders its current installation and two delivery evidence links", async ({ page }) => {
  await page.goto("/modules/s2/");
  await expect(page.locator('[data-evidence-kind="delivery"] a')).toHaveText([
    "Delivery evidence 1",
    "Delivery evidence 2",
  ]);
  await expect(
    page.locator(".facts div").filter({ hasText: "Delivery status" }).locator("dd"),
  ).toHaveText("Delivered");
  await expect(page.locator('[data-evidence-kind="production"]')).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText("Production evidence declared");
  await expect(page.locator("[data-evidence-empty]")).toHaveCount(0);
  await expect(page.locator('[aria-labelledby="installation"]')).toContainText(
    "Source-delivered, not marketplace-published",
  );
  await expect(page.locator('[aria-labelledby="installation"]')).toContainText(
    "pnpm --dir packages/vscode-extension run package",
  );
});

test("/modules nav includes Modules with aria-current", async ({ page }) => {
  await page.goto("/modules/");
  await expect(page.locator("header nav a[href='/modules']")).toHaveAttribute(
    "aria-current",
    "page",
  );
});

for (const id of ["s1", "s2", "s236"]) {
  test("/modules/" + id + "/ has zero axe violations and one main landmark", async ({
    page,
  }) => {
    await page.goto("/modules/" + id + "/");
    const results = await new AxeBuilder({ page }).withTags(axeTags).analyze();
    expect(
      results.violations,
      "axe violations on /modules/" + id + "/:\n"
        + JSON.stringify(results.violations, null, 2),
    ).toEqual([]);
    await expect(page.locator("main")).toHaveCount(1);
    await expect(page.locator("main main")).toHaveCount(0);
  });
}
