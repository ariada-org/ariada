// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import type { OriginArtifacts } from '@ariada-org/core-engine';
import type { Page } from 'playwright';

/**
 * What an origin says about itself in the two files agents look for.
 *
 * The rules that read these have to tell three things apart, and only one of
 * them is a finding: the file is there, the file is not there, and nobody
 * asked. Until now nothing asked, so the analyzer saw no file and — before it
 * was corrected — reported every site as missing both, including sites that
 * serve them. The published scanner still does; it says `robots.txt` is absent
 * on the very site whose `robots.txt` returns 200.
 *
 * So the shape here keeps "could not ask" distinct from "asked and it is not
 * there". A refusal at the network level leaves the field unset, and the rules
 * stay quiet; a 404 is an answer and sets it to the empty string, which is what
 * absence means once somebody has looked.
 */
export interface ArtifactAnswer {
  /** HTTP status, or null when the request could not be made at all. */
  status: number | null;
  body: string;
}

const NASHLOS_MIN = 200;
const NASHLOS_MAX = 299;

/**
 * Turn two answers into the artifacts record, or into nothing.
 *
 * Pure, and separate from the fetching, because it decides what a report does
 * NOT say — and that decision is worth holding by cases that no browser is
 * needed to run.
 */
export function artifactsFromAnswers(
  robots: ArtifactAnswer,
  llms: ArtifactAnswer,
): OriginArtifacts | undefined {
  const out: OriginArtifacts = {};
  let sprosili = false;

  if (robots.status !== null) {
    sprosili = true;
    out.robotsTxt = robots.status >= NASHLOS_MIN && robots.status <= NASHLOS_MAX ? robots.body : '';
  }
  if (llms.status !== null) {
    sprosili = true;
    out.llmsTxt = llms.status >= NASHLOS_MIN && llms.status <= NASHLOS_MAX ? llms.body : '';
  }

  // Neither could be asked: return nothing rather than an empty record. An
  // empty record is indistinguishable from "asked, and both are absent", which
  // is the confusion this whole module exists to prevent.
  return sprosili ? out : undefined;
}

/** Ask one origin-level file, and never throw: a refusal is an answer of its own. */
async function sprosit(page: Page, adres: string, timeoutMs: number): Promise<ArtifactAnswer> {
  try {
    // Через контекст страницы, а не отдельным клиентом: те же куки, тот же
    // разбор имени и то же соединение, что у самой страницы. Отдельный клиент
    // отвечал бы про другой запрос, чем тот, о котором отчитываемся.
    const otvet = await page.request.get(adres, { timeout: timeoutMs, failOnStatusCode: false });
    const status = otvet.status();
    if (status < NASHLOS_MIN || status > NASHLOS_MAX) return { status, body: '' };
    return { status, body: await otvet.text() };
  } catch {
    return { status: null, body: '' };
  }
}

/**
 * Ask the origin for `robots.txt` and `llms.txt`.
 *
 * Only the origin of the page already loaded is asked, so whatever guard let
 * the navigation through covers these too — no new host is reached.
 */
export async function fetchOriginArtifacts(
  page: Page,
  url: string,
  timeoutMs: number,
): Promise<OriginArtifacts | undefined> {
  let origin: string;
  try {
    origin = new URL(url).origin;
  } catch {
    return undefined;
  }
  const [robots, llms] = await Promise.all([
    sprosit(page, `${origin}/robots.txt`, timeoutMs),
    sprosit(page, `${origin}/llms.txt`, timeoutMs),
  ]);
  return artifactsFromAnswers(robots, llms);
}
