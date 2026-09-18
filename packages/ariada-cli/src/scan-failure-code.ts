// SPDX-FileCopyrightText: 2026 Alexander Brichkin (Agonist Development AB)
// SPDX-License-Identifier: EUPL-1.2
import type { CliErrorCode } from './errors.js';

/**
 * Which failure this was, from what the scanner said about it.
 *
 * Three different things used to arrive under one code. Asked to scan a
 * loopback address, the published tool answered `E_NAVIGATION_FAILED`, which is
 * not what happened: the address was refused by policy and no navigation was
 * attempted. With no browser installed it answered the same code, again for
 * something that is not a navigation failure. A caller branching on the code
 * cannot tell "install a browser" from "this will never work" from "try again",
 * and the middle one is the only one worth retrying.
 *
 * Matching on the message is not where this should end. The right shape is for
 * whatever throws to carry its own code, and that crosses three packages with
 * the CLI as their only consumer today — so the markers matched here are ones
 * our own code emits, and the cases below name them.
 */
export function scanFailureCode(message: string): CliErrorCode {
  if (/Refused to scan URL/i.test(message)) return 'E_URL_REFUSED';
  if (/No browser to run the page in|browser(Type)?\.launch|Executable doesn't exist/i.test(message)) {
    return 'E_BROWSER_LAUNCH';
  }
  if (/timeout/i.test(message)) return 'E_NAVIGATION_TIMEOUT';
  return 'E_NAVIGATION_FAILED';
}
