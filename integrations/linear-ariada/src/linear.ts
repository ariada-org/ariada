import type { LinearIssue, LinearIssueInput, LinearTransport } from './types.js';

export class LinearGraphQL implements LinearTransport {
    private readonly token: string;
    private readonly endpoint: string;

    constructor(token: string, endpoint = 'https://api.linear.app/graphql') {
        this.token = token;
        this.endpoint = endpoint;
    }
    async request<T>(query: string, variables: Record<string, unknown>): Promise<T> {
        const response = await fetch(this.endpoint, { method: 'POST', headers: { authorization: this.token, 'content-type': 'application/json' }, body: JSON.stringify({ query, variables }) });
        if (!response.ok)
            throw new Error(`Linear GraphQL HTTP ${response.status}`);
        // `json()` gives `any`, and the shapes below are what Linear documents.
        // An assertion here would be the same claim with parentheses around it.
        const payload = await response.json();
        if (payload.errors?.length)
            throw new Error(`Linear GraphQL: ${payload.errors.map((error: { message: string }) => error.message).join('; ')}`);
        if (!payload.data)
            throw new Error('Linear GraphQL returned no data');
        return payload.data;
    }
}
const issueQuery = `query AriadaIssues($teamId: ID!) { issues(filter: { team: { id: { eq: $teamId } } }, first: 250) { nodes { id identifier url title description labels { nodes { name } } } } }`;
const issueMutation = `mutation AriadaCreateIssue($input: IssueCreateInput!) { issueCreate(input: $input) { success issue { id identifier url title description labels { nodes { name } } } } }`;
export async function listTeamIssues(transport: LinearTransport, teamId: string): Promise<LinearIssue[]> {
    const result = await transport.request<{ issues: { nodes: LinearIssue[] } }>(issueQuery, { teamId });
    return result.issues.nodes;
}
export async function createIssue(transport: LinearTransport, input: LinearIssueInput): Promise<LinearIssue> {
    const result = await transport.request<{ issueCreate: { success: boolean; issue?: LinearIssue } }>(issueMutation, { input: { teamId: input.teamId, title: input.title, description: input.description, labelNames: input.labelNames } });
    if (!result.issueCreate.success || !result.issueCreate.issue)
        throw new Error('Linear issueCreate was not successful');
    return result.issueCreate.issue;
}
