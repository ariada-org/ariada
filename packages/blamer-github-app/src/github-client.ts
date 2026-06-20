// SPDX-License-Identifier: EUPL-1.2
// Copyright Agonist Development AB — see NOTICE
import type {
  CheckRunConclusion,
  CheckRunCreated,
  CheckRunStatus,
  DiffHunk,
  PostCommentPayload,
} from './types.js';

/**
 * Thin GitHub REST API v3 client.
 * All calls go to `baseUrl` — override to http://localhost:3099 in tests.
 * Uses a per-installation token (provided externally — production obtains it
 * from the GitHub App JWT exchange; tests use a fixture token).
 */
export class GitHubRestClient {
  readonly #baseUrl: string;
  readonly #token: string;

  constructor(baseUrl: string, token: string) {
    this.#baseUrl = baseUrl;
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

  /** Create a check run in queued/in_progress state. Returns the check run ID. */
  async createCheckRun(
    owner: string,
    repo: string,
    name: string,
    headSha: string,
    status: CheckRunStatus = 'queued',
  ): Promise<CheckRunCreated> {
    const url = `${this.#baseUrl}/repos/${owner}/${repo}/check-runs`;
    const response = await fetch(url, {
      method: 'POST',
      headers: this.#headers(),
      body: JSON.stringify({ name, head_sha: headSha, status }),
    });

    if (!response.ok) {
      throw new Error(`GitHub API error creating check run: HTTP ${response.status}`);
    }

    const body = (await response.json()) as { id: number; html_url: string };
    return { id: body.id, htmlUrl: body.html_url };
  }

  /** Update an existing check run with conclusion and summary. */
  async updateCheckRun(
    owner: string,
    repo: string,
    checkRunId: number,
    conclusion: CheckRunConclusion,
    summary: string,
  ): Promise<void> {
    const url = `${this.#baseUrl}/repos/${owner}/${repo}/check-runs/${checkRunId}`;
    const response = await fetch(url, {
      method: 'PATCH',
      headers: this.#headers(),
      body: JSON.stringify({
        status: 'completed' as CheckRunStatus,
        conclusion,
        completed_at: new Date().toISOString(),
        output: {
          title: 'Blamer attribution audit',
          summary,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`GitHub API error updating check run: HTTP ${response.status}`);
    }
  }

  /** Post a comment on a PR (issue comments endpoint). */
  async postComment(payload: PostCommentPayload): Promise<{ id: number; htmlUrl: string }> {
    const url = `${this.#baseUrl}/repos/${payload.owner}/${payload.repo}/issues/${payload.issueNumber}/comments`;
    const response = await fetch(url, {
      method: 'POST',
      headers: this.#headers(),
      body: JSON.stringify({ body: payload.body }),
    });

    if (!response.ok) {
      throw new Error(`GitHub API error posting comment: HTTP ${response.status}`);
    }

    const body = (await response.json()) as { id: number; html_url: string };
    return { id: body.id, htmlUrl: body.html_url };
  }

  /** Fetch the list of changed files for a PR. Returns simplified diff hunks. */
  async getPullRequestFiles(
    owner: string,
    repo: string,
    pullNumber: number,
  ): Promise<DiffHunk[]> {
    const url = `${this.#baseUrl}/repos/${owner}/${repo}/pulls/${pullNumber}/files`;
    const response = await fetch(url, {
      headers: this.#headers(),
    });

    if (!response.ok) {
      throw new Error(`GitHub API error fetching PR files: HTTP ${response.status}`);
    }

    const files = (await response.json()) as Array<{
      filename: string;
      patch?: string;
      additions: number;
      deletions: number;
    }>;

    return files
      .filter((f) => f.patch !== undefined)
      .map((f) => ({
        filePath: f.filename,
        startLine: 1,
        endLine: f.additions,
        content: f.patch ?? '',
        language: inferLanguage(f.filename),
      }));
  }
}

/** Infer programming language from file extension — best effort. */
function inferLanguage(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    mjs: 'javascript',
    cjs: 'javascript',
    py: 'python',
    go: 'go',
    rs: 'rust',
    java: 'java',
    kt: 'kotlin',
    swift: 'swift',
    rb: 'ruby',
    php: 'php',
    cs: 'csharp',
    cpp: 'cpp',
    c: 'c',
  };
  return map[ext] ?? 'unknown';
}
