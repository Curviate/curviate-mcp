<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/curviate-lockup-horizontal-dark.png">
    <img src="assets/curviate-lockup-horizontal-light.png" width="360" alt="Curviate">
  </picture>
</p>

<p align="center">
  <strong>LinkedIn actions for AI agents, as MCP tools. One hosted URL, nothing to install.</strong>
</p>

<p align="center">
  <a href="https://docs.curviate.com/reference/mcp/quickstart"><img alt="docs curviate.com" src="https://img.shields.io/badge/docs-curviate.com-E02F29?style=flat-square&labelColor=0A0A0F"></a>
  <img alt="transport streamable http" src="https://img.shields.io/badge/transport-streamable%20http-6B6B70?style=flat-square&labelColor=0A0A0F">
  <img alt="auth oauth 2.1" src="https://img.shields.io/badge/auth-oauth%202.1-6B6B70?style=flat-square&labelColor=0A0A0F">
  <img alt="hosting eu" src="https://img.shields.io/badge/hosting-eu-6B6B70?style=flat-square&labelColor=0A0A0F">
  <img alt="license mit" src="https://img.shields.io/badge/license-mit-6B6B70?style=flat-square&labelColor=0A0A0F">
</p>

## Connect in 30 seconds

Point any MCP client that speaks remote Streamable HTTP at one URL:

```
https://app.curviate.com/mcp
```

Sign in with OAuth where the client offers it, otherwise send your Curviate API key as an `Authorization: Bearer` header. Your agent then has LinkedIn search, messaging, posts and connection requests as native tools. Sales Navigator and Recruiter tools are off by default and switch on per workspace, and they answer only for a connected account that holds the product: see [Toolsets](https://docs.curviate.com/reference/mcp/toolsets).

You need a [Curviate workspace](https://app.curviate.com) and one connected LinkedIn account. Full walkthrough: [MCP quickstart](https://docs.curviate.com/reference/mcp/quickstart).

## Your client

<details>
<summary><b>Claude Code</b></summary>

<br>

OAuth:

```bash
claude mcp add --transport http curviate https://app.curviate.com/mcp
```

Then run `/mcp` in Claude Code, select **curviate**, choose **Authenticate**, and approve access in the browser.

API key:

```bash
claude mcp add --transport http curviate https://app.curviate.com/mcp \
  --header "Authorization: Bearer $CURVIATE_API_KEY"
```

Your shell expands `$CURVIATE_API_KEY` when you run that command, so the key itself lands in Claude Code's config file. Prefer the OAuth path above unless you need a key.

Check either setup with `claude mcp list`: `curviate` reads `Connected`.

Details and caveats: [docs.curviate.com/reference/mcp/client-setup#claude-code](https://docs.curviate.com/reference/mcp/client-setup#claude-code)

</details>

<details>
<summary><b>Codex</b></summary>

<br>

OAuth:

```bash
codex mcp add curviate --url https://app.curviate.com/mcp
```

Codex prints an authorization URL. Open it, sign in to Curviate, and approve access. To sign in again later, run `codex mcp login curviate`.

API key, read from the environment each time Codex connects:

```bash
codex mcp add curviate --url https://app.curviate.com/mcp \
  --bearer-token-env-var CURVIATE_API_KEY
```

Check with `codex mcp list`.

Details and caveats: [docs.curviate.com/reference/mcp/client-setup#codex](https://docs.curviate.com/reference/mcp/client-setup#codex)

</details>

<details>
<summary><b>Gemini CLI</b></summary>

<br>

OAuth:

```bash
gemini mcp add --transport http curviate https://app.curviate.com/mcp
```

Then start `gemini`, run `/mcp auth curviate`, open the printed URL, sign in to Curviate, and approve access.

API key:

```bash
gemini mcp add --transport http curviate https://app.curviate.com/mcp \
  -H 'Authorization: Bearer ${CURVIATE_API_KEY}'
```

Keep the single quotes: Gemini CLI stores `${CURVIATE_API_KEY}` as written and fills it from the environment when it connects, so the key stays out of the settings file.

Check with `gemini mcp list`: `curviate` reads `Connected`. Gemini CLI will not start MCP servers in a folder you have not trusted, where the server reads `Disabled` instead.

Details and caveats: [docs.curviate.com/reference/mcp/client-setup#gemini-cli](https://docs.curviate.com/reference/mcp/client-setup#gemini-cli)

</details>

<details>
<summary><b>Another client</b></summary>

<br>

Any client that speaks remote Streamable HTTP can connect. Try OAuth with the bare URL first, then the `Authorization: Bearer` header. A client that connects but fails tool calls with `401` is usually sending the header only on connect: see [Troubleshooting](https://docs.curviate.com/reference/mcp/troubleshooting#header-on-connect-only).

</details>

## Authentication

| Method | Use it when |
|---|---|
| **OAuth 2.1** | The client supports it. Always the first choice: no key leaves the dashboard, and you revoke the client on its own under **Settings**, **Authorized applications**. |
| **`Authorization: Bearer cvt_live_YOUR_KEY`** | The client can set a header but has no OAuth, or runs unattended. |
| **`?token=cvt_live_YOUR_KEY`** | Last resort, for a client that can set no header. The header wins if a request carries both. |

Your API key is a full-access workspace credential: anyone holding it can act on every LinkedIn account in the workspace. Create, rotate and revoke it from the key chip in the [dashboard](https://app.curviate.com) top bar, keep it in an environment variable, and reference the variable from the client config rather than the literal key.

Full rules: [Authentication](https://docs.curviate.com/reference/mcp/authentication).

## Things to ask your agent

```
Find heads of engineering at Series B fintech companies in Berlin who posted about hiring in the last month.
```

```
Triage my LinkedIn inbox: summarize every thread still waiting on me, then draft a reply to each one.
```

```
Show me the five most relevant people who commented on my last post, and draft a connection request note for each referencing what they said. I will say which ones to send.
```

```
Draft a post about what we shipped this week, in my voice, and show it to me before anything goes out.
```

```
Review the Sales Navigator leads I saved this week and flag the ones who recently changed jobs.
```

## Links

| | |
|---|---|
| [MCP quickstart](https://docs.curviate.com/reference/mcp/quickstart) | Connect a client and make a first call |
| [Client setup](https://docs.curviate.com/reference/mcp/client-setup) | Per-client commands and UI paths |
| [Authentication](https://docs.curviate.com/reference/mcp/authentication) | OAuth, the Bearer header, and `?token=` |
| [Toolsets](https://docs.curviate.com/reference/mcp/toolsets) | Which tools your client sees, and how to turn more on |
| [Errors and limits](https://docs.curviate.com/reference/mcp/errors-and-limits) | The error shape, rate limits, safety limits |
| [Troubleshooting](https://docs.curviate.com/reference/mcp/troubleshooting) | 401s, a missing tool, a dropped session |
| [curviate.com](https://curviate.com) | What Curviate is |
| [CLI](https://github.com/Curviate/curviate-cli) | The same actions from a terminal or a shell script |
| [TypeScript SDK](https://github.com/Curviate/curviate-sdk) | The same actions from your own code |

## License

MIT. See [LICENSE](LICENSE).
