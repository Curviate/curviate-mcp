<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./assets/curviate-lockup-horizontal-dark.png">
  <img alt="Curviate" src="./assets/curviate-lockup-horizontal-light.png" width="360">
</picture>

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
| `update_my_profile` | Update the caller's own profile fields, photo, and cover photo. |
| `list_profile_activity` | List a person's posts, comments, reactions, or saved posts. |
| `list_network` | List a person's connections, followers, or following. |
| `get_my_insights` | Get the caller's own subscription, analytics, visitors, SSI, and InMail credits. |
| `endorse_skill` | Endorse a 1st-degree connection's skill. |
| `follow_user` | Follow a LinkedIn member. |
| `unfollow_user` | Unfollow a LinkedIn member. |
| `search_people` | Search LinkedIn members with structured filters. |
| `search_companies` | Search LinkedIn company pages with structured filters. |
| `search_posts` | Search LinkedIn posts with structured filters. |
| `search_jobs` | Search LinkedIn job postings with structured filters. |
| `search_services` | Search LinkedIn service providers. |
| `search_from_url` | Run a pasted LinkedIn search URL directly. |
| `search_groups` | Keyword search for LinkedIn groups. |
| `list_group_members` | List a group's members. |
| `get_company` | Retrieve a LinkedIn company page's full profile. |
| `browse_company` | List a company page's employees, posts, jobs, or followers. |
| `list_managed_companies` | List company pages the account administers. |
| `list_chats` | List the account's conversations. |
| `read_chat` | List the messages in one chat. |
| `start_chat` | Start a new conversation and send the opening message. |
| `send_message` | Send a message into an existing chat. |
| `edit_message` | Edit a previously sent message. |
| `delete_message` | Delete a previously sent message. |
| `react_to_message` | Add a native emoji reaction to a chat message. |
| `update_chat` | Mark a chat read or unread. |
| `get_feed` | Read the account's LinkedIn home feed. |
| `list_notifications` | List the account's LinkedIn notifications. |
| `dismiss_notification` | Delete or show-less a notification. |
| `get_post` | Retrieve a single post's full detail. |
| `create_post` | Publish a new post. |
| `delete_post` | Delete a post the account owns. |
| `list_post_engagement` | List a post's or comment's comments, replies, or reactions. |
| `save_post` | Save or unsave a post to the account's bookmark list. |
| `add_comment` | Comment on a post. |
| `update_comment` | Edit a comment the account authored. |
| `delete_comment` | Delete a comment the account authored. |
| `add_reaction` | React to a post. |
| `remove_reaction` | Remove the account's reaction from a post. |
| `list_invitations` | List received or sent connect-requests. |
| `send_connection_request` | Send a connect-request to a member. |
| `respond_to_invitation` | Accept or decline a received connect-request. |
| `withdraw_invitation` | Withdraw a connect-request the account sent. |
| `list_jobs` | List the account's own job postings. |
| `get_job` | Get a job posting, optionally with its budget. |
| `create_job_draft` | Create a classic job posting draft. |
| `edit_job` | Edit a job posting the account owns. |
| `transition_job` | Publish or close a job posting. |
| `list_job_applicants` | List a job posting's applicants, or fetch one applicant. |

Each tool's input schema and read-only/destructive annotations are discoverable through `tools/list`, standard
MCP introspection, no separate reference is needed to see the exact parameters.

## Errors

A failed call returns `isError: true` with the Curviate API's structured error body as the tool result text, the
same `{ code, message, retry_hint, user_fixable, retry_likely_to_succeed }` shape documented at
[docs.curviate.com](https://docs.curviate.com), verbatim. Nothing is translated or re-wrapped in between, an
agent branching on `code` sees exactly what the REST API would have returned.

## Roadmap

v1 shipped the highest-value core read and core write tools (20 total). This tranche adds profile management and
insights, following, company browsing, messaging extras, notifications, post and comment lifecycle management,
connect-request withdrawal, classic job postings, and the remaining search surface (52 total). Additional tools
land incrementally as the surface grows toward full parity with the hosted MCP endpoint: Sales Navigator search
and outreach, Recruiter search and project/pipeline management, company page admin messaging and follow-invite
campaigns, and webhook management. Each addition is one file under `src/tools/`, no architecture change required.

## License

[MIT](./LICENSE)
