// SPDX-License-Identifier: EUPL-1.2
// Copyright Agonist Development AB — see NOTICE
//
// Thin GitHub REST API v3 client.
// All calls go to `baseUrl` — override to http://localhost:NNNN in tests.

import type { OpenedFixPr } from './types/github.js';

const DEFAULT_GITHUB_API = 'https://api.github.com';

/**
 * Thin GitHub REST API v3 client used by the reverter adapter.
 * Uses a per-installation token (provided by the host service at runtime).
 */
export class GitHubClient {
  readonly #baseUrl: string;
  readonly #token: string;

  constructor(token: string, baseUrl?: string) {
    this.#baseUrl = (baseUrl ?? DEFAULT_GITHUB_API).replace(/\/$/, '');
    this.#token = token;
  }

  #headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.#token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
    };
  }

  /**
   * Fetch the raw content of a file at a given ref.
   * Returns the UTF-8 decoded string, or null if the file does not exist.
   */
  async getFileContent(
    owner: string,
    repo: string,
    filePath: string,
    ref: string,
  ): Promise<string | null> {
    const url = `${this.#baseUrl}/repos/${owner}/${repo}/contents/${encodeURIComponent(filePath)}?ref=${encodeURIComponent(ref)}`;
    const response = await fetch(url, { headers: this.#headers() });

    if (response.status === 404) return null;
    if (!response.ok) {
      throw new Error(`GitHub API error fetching file content: HTTP ${response.status}`);
    }

    const body = (await response.json()) as {
      content?: string;
      encoding?: string;
      type?: string;
    };

    if (body.type !== 'file' || !body.content) return null;
    // GitHub returns base64-encoded content with newlines
    const raw = body.content.replace(/\n/g, '');
    return Buffer.from(raw, 'base64').toString('utf8');
  }

  /**
   * Create or update a branch pointing at the given commit SHA.
   * If the branch already exists, it is updated (not force-pushed — returns false).
   */
  async createBranch(
    owner: string,
    repo: string,
    branchName: string,
    fromSha: string,
  ): Promise<boolean> {
    const url = `${this.#baseUrl}/repos/${owner}/${repo}/git/refs`;
    const response = await fetch(url, {
      method: 'POST',
      headers: this.#headers(),
      body: JSON.stringify({
        ref: `refs/heads/${branchName}`,
        sha: fromSha,
      }),
    });

    if (response.status === 422) {
      // Branch already exists — not an error, just skip
      return false;
    }
    if (!response.ok) {
      throw new Error(`GitHub API error creating branch: HTTP ${response.status}`);
    }
    return true;
  }

  /**
   * Commit a single file change to an existing branch.
   * Uses the GitHub Contents API (creates or updates the file in one call).
   */
  async commitFile(
    owner: string,
    repo: string,
    filePath: string,
    content: string,
    message: string,
    branchName: string,
  ): Promise<string> {
    // Get the current file SHA so we can update it
    const existingUrl = `${this.#baseUrl}/repos/${owner}/${repo}/contents/${encodeURIComponent(filePath)}?ref=${encodeURIComponent(branchName)}`;
    const existingResponse = await fetch(existingUrl, { headers: this.#headers() });
    let existingSha: string | undefined;
    if (existingResponse.ok) {
      const existing = (await existingResponse.json()) as { sha?: string };
      existingSha = existing.sha;
    }

    const url = `${this.#baseUrl}/repos/${owner}/${repo}/contents/${encodeURIComponent(filePath)}`;
    const response = await fetch(url, {
      method: 'PUT',
      headers: this.#headers(),
      body: JSON.stringify({
        message,
        content: Buffer.from(content, 'utf8').toString('base64'),
        branch: branchName,
        ...(existingSha !== undefined && { sha: existingSha }),
      }),
    });

    if (!response.ok) {
      throw new Error(`GitHub API error committing file: HTTP ${response.status}`);
    }

    const body = (await response.json()) as { commit?: { sha?: string } };
    return body.commit?.sha ?? '';
  }

  /**
   * Open a draft pull request.
   * Always opens as a draft — this is a hard invariant that cannot be bypassed.
   */
  async openDraftPr(
    owner: string,
    repo: string,
    title: string,
    body: string,
    headBranch: string,
    baseBranch: string,
  ): Promise<OpenedFixPr> {
    const url = `${this.#baseUrl}/repos/${owner}/${repo}/pulls`;
    const response = await fetch(url, {
      method: 'POST',
      headers: this.#headers(),
      body: JSON.stringify({
        title,
        body,
        head: headBranch,
        base: baseBranch,
        draft: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`GitHub API error opening draft PR: HTTP ${response.status}`);
    }

    const pr = (await response.json()) as {
      number: number;
      html_url: string;
      draft: boolean;
    };

    return {
      number: pr.number,
      htmlUrl: pr.html_url,
      branchName: headBranch,
      draft: true,
    };
  }

  /**
   * Post a comment on an issue (= PR comment thread).
   * Used for the rate-limit upgrade CTA.
   */
  async postIssueComment(
    owner: string,
    repo: string,
    issueNumber: number,
    body: string,
  ): Promise<{ id: number }> {
    const url = `${this.#baseUrl}/repos/${owner}/${repo}/issues/${issueNumber}/comments`;
    const response = await fetch(url, {
      method: 'POST',
      headers: this.#headers(),
      body: JSON.stringify({ body }),
    });

    if (!response.ok) {
      throw new Error(`GitHub API error posting issue comment: HTTP ${response.status}`);
    }

    const result = (await response.json()) as { id: number };
    return { id: result.id };
  }
}
