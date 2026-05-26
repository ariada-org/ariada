// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { beforeEach, describe, expect, it } from "vitest";

import { getAccessibleNameLite } from "./helpers.js";
import { resetBody, setBodyFromFragment } from "./test-utils.js";

describe("getAccessibleNameLite", () => {
  beforeEach(resetBody);

  it("resolves explicit labels by DOM association when the id is not CSS-selector-safe", () => {
    const document = setBodyFromFragment(`
      <label for='billing"email'>Billing email</label>
      <input id='billing"email' type="email">
    `);

    const input = document.getElementById('billing"email');

    expect(input).toBeInstanceOf(HTMLInputElement);
    expect(() => getAccessibleNameLite(input as Element)).not.toThrow();
    expect(getAccessibleNameLite(input as Element)).toBe("Billing email");
  });
});
