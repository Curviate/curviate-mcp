# @curviate/mcp

Official [Model Context Protocol](https://modelcontextprotocol.io) server for the
[Curviate API](https://docs.curviate.com): LinkedIn actions for AI agents, over stdio.

Built on [`@curviate/sdk`](https://www.npmjs.com/package/@curviate/sdk) and the official
[`@modelcontextprotocol/sdk`](https://www.npmjs.com/package/@modelcontextprotocol/sdk). Every tool call is a
single typed SDK call against the Curviate REST API, structured errors and all, no local reimplementation of
LinkedIn's business logic.

## Install

### npx (no install required)

```bash
npx @curviate/mcp
```

### Claude Code

```bash
claude mcp add curviate -e CURVIATE_API_KEY=<your-api-key> -- npx -y @curviate/mcp
```

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "curviate": {
      "command": "npx",
      "args": ["-y", "@curviate/mcp"],
      "env": {
        "CURVIATE_API_KEY": "<your-api-key>"
      }
    }
  }
}
```

### Cursor

Add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "curviate": {
      "command": "npx",
      "args": ["-y", "@curviate/mcp"],
      "env": {
        "CURVIATE_API_KEY": "<your-api-key>"
      }
    }
  }
}
```

### VS Code (Copilot Chat)

Add to `.vscode/mcp.json` (note the top-level key is `servers`, not `mcpServers`):

```json
{
  "servers": {
    "curviate": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@curviate/mcp"],
      "env": {
        "CURVIATE_API_KEY": "<your-api-key>"
      }
    }
  }
}
```

## Authentication

Get an API key from the [Curviate dashboard](https://app.curviate.com). Pass it via the `CURVIATE_API_KEY`
environment variable (preferred, shown above) or with a `--api-key` flag as a documented fallback:

```bash
npx @curviate/mcp --api-key <your-api-key>
```

A key passed as `--api-key` is visible to other users on the machine through `ps`/process listings and lands in
shell history; prefer the environment variable in every context where it's available.

Override the API base URL (for testing against a non-production environment) with `CURVIATE_BASE_URL`.

## Also available: hosted remote MCP

Curviate also runs a hosted, remote Streamable HTTP MCP endpoint at `https://app.curviate.com/mcp`, authenticated
with your API key as a bearer token. Clients with native remote-MCP support (Claude Code, Claude Desktop
Connectors, Claude.ai, ChatGPT Developer Mode, Cursor, VS Code) can point at it directly instead of running this
package locally:

```bash
claude mcp add --transport http curviate https://app.curviate.com/mcp --header "Authorization: Bearer <your-api-key>"
```

This package exists for stdio-only clients (and anyone who prefers a locally-spawned process) and stays in sync
with the same tool surface the hosted endpoint serves.

## Tools

Every tool takes an `account_id`, the connected LinkedIn account to act as (from `list_accounts`), except
`list_accounts` and `get_account` themselves, which are tenant-wide.

| Tool | Description |
|---|---|
| `list_accounts` | List the tenant's connected LinkedIn accounts. |
| `get_account` | Get metadata and quota state for one connected account. |
| `get_profile` | Retrieve a LinkedIn member's profile. |
| `search_people` | Search LinkedIn members with structured filters. |
| `search_companies` | Search LinkedIn company pages with structured filters. |
| `search_posts` | Search LinkedIn posts with structured filters. |
| `search_jobs` | Search LinkedIn job postings with structured filters. |
| `get_company` | Retrieve a LinkedIn company page's full profile. |
| `list_chats` | List the account's conversations. |
| `read_chat` | List the messages in one chat. |
| `start_chat` | Start a new conversation and send the opening message. |
| `send_message` | Send a message into an existing chat. |
| `get_feed` | Read the account's LinkedIn home feed. |
| `get_post` | Retrieve a single post's full detail. |
| `create_post` | Publish a new post. |
| `add_comment` | Comment on a post. |
| `add_reaction` | React to a post. |
| `list_invitations` | List received or sent connect-requests. |
| `send_connection_request` | Send a connect-request to a member. |
| `respond_to_invitation` | Accept or decline a received connect-request. |

Each tool's input schema and read-only/destructive annotations are discoverable through `tools/list`, standard
MCP introspection, no separate reference is needed to see the exact parameters.

## Errors

A failed call returns `isError: true` with the Curviate API's structured error body as the tool result text, the
same `{ code, message, retry_hint, user_fixable, retry_likely_to_succeed }` shape documented at
[docs.curviate.com](https://docs.curviate.com), verbatim. Nothing is translated or re-wrapped in between, an
agent branching on `code` sees exactly what the REST API would have returned.

## Roadmap

v1 ships the highest-value core read and core write tools (20 total, listed above). Additional tools land
incrementally as the surface grows toward parity with the hosted MCP endpoint: recruiter and Sales Navigator
search, groups, notifications, job posting and applicant management, saved posts, follows, endorsements, company
page admin messaging, and webhook management. Each addition is one file under `src/tools/`, no architecture
change required.

## License

[MIT](./LICENSE)
