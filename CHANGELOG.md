# Changelog

All notable changes to `@curviate/mcp` are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html):
a new tool is a minor; a breaking tool/schema/error-shape change is a major; a fix is a patch.

## [Unreleased]

### Added

- 26 Sales Navigator, Recruiter, and Company Admin tools, reaching full tool-surface parity (78 tools) with
  the hosted MCP endpoint:
  - Sales Navigator (requires a Sales Navigator seat): `sn_search_people`, `sn_search_companies`,
    `sn_search_from_url`, `sn_get_profile`, `sn_start_chat`, `sn_list_lists`, `sn_save_lead`, `sn_save_account`.
  - Recruiter (requires a Recruiter seat): `rec_search_candidates`, `rec_search_talent_pool`,
    `rec_search_from_url`, `rec_get_profile`, `rec_start_chat`, `rec_list_projects`, `rec_edit_project`,
    `rec_list_pipeline`, `rec_save_candidate`, `rec_list_applicants`, `rec_list_jobs`, `rec_create_job_draft`,
    `rec_edit_job`, `rec_transition_job`.
  - Company Admin (page-admin only, beta): `list_company_chats`, `read_company_chat`, `reply_company_chat`,
    `invite_followers`.
- 52 tools carried over unchanged from the prior tranche (not previously logged here): profile management and
  insights, following, company browsing, messaging extras, notifications, post and comment lifecycle
  management, connect-request withdrawal, classic job postings, and the remaining search surface, on top of
  the original 20 core tools.

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
