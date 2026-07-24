# Changelog

All notable changes to `@curviate/mcp` are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html):
a new tool is a minor; a breaking tool/schema/error-shape change is a major; a fix is a patch.

## [Unreleased]

## [0.2.0] - 2026-07-21

Reshaped from a local tool reimplementation to a thin stdio bridge (ADR-051). Not yet published to npm.

### Changed

- **Breaking**: `@curviate/mcp` no longer implements any LinkedIn tool locally. It now forwards every MCP
  message (`initialize`, `tools/list`, `tools/call`, and every other client-visible method) between the local
  stdio client and the hosted endpoint at `CURVIATE_MCP_URL` (default `https://app.curviate.com/mcp`),
  authenticated with `CURVIATE_API_KEY` as an `Authorization: Bearer` header. The hosted server is now the
  single source of truth for the tool surface: this package auto-tracks it with zero drift and ships no tool
  descriptions in open source.
- `CURVIATE_BASE_URL` is replaced by `CURVIATE_MCP_URL` (and `--base-url` by `--mcp-url`): the package no
  longer calls the Curviate REST API directly, it points at the hosted MCP endpoint itself.

### Removed

- The 78-tool local reimplementation on `@curviate/sdk` (all of `src/tools/`, `src/tool-result.ts`,
  `src/server.ts`). History remains in git.
- The `@curviate/sdk` and `zod` dependencies (no longer needed: the bridge does not call the REST API or
  validate tool schemas locally).

### Added

- `src/bridge.ts`: the transport-level forwarding logic (`createRemoteTransport`, `pipeTransports`), a few
  hundred lines total.

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
