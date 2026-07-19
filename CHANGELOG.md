# Changelog

All notable changes to `@curviate/mcp` are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html):
a new tool is a minor; a breaking tool/schema/error-shape change is a major; a fix is a patch.

## [Unreleased]

## [0.1.0] - 2026-07-19

Initial release. Not yet published to npm.

### Added

- Stdio MCP server built on `@curviate/sdk` and `@modelcontextprotocol/sdk`.
- 20 core read and core write tools: `list_accounts`, `get_account`, `get_profile`, `search_people`,
  `search_companies`, `search_posts`, `search_jobs`, `get_company`, `list_chats`, `read_chat`, `start_chat`,
  `send_message`, `get_feed`, `get_post`, `create_post`, `add_comment`, `add_reaction`, `list_invitations`,
  `send_connection_request`, `respond_to_invitation`.
- `CURVIATE_API_KEY` environment variable auth, with a `--api-key` flag fallback.
- `CURVIATE_BASE_URL` environment variable to target a non-production API.
- `server.json` registering both the npm package and the hosted remote MCP endpoint.
