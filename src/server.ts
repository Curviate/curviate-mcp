/**
 * Server factory: builds an `McpServer` wired to a `Curviate` client, with
 * every tool group registered. Kept separate from `index.ts` (the stdio bin
 * entry) so tests can boot the server over an in-memory transport pair
 * without spawning a process.
 */
import { Curviate } from "@curviate/sdk";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAllTools } from "./tools/index.js";

export interface CreateServerOptions {
  apiKey: string;
  baseUrl?: string;
  version: string;
  /** Injectable transport, test-only seam (mirrors the SDK's own `fetch` option). */
  fetch?: typeof fetch;
}

export function createServer(options: CreateServerOptions): McpServer {
  const curviate = new Curviate({
    apiKey: options.apiKey,
    ...(options.baseUrl !== undefined ? { baseUrl: options.baseUrl } : {}),
    ...(options.fetch !== undefined ? { fetch: options.fetch } : {}),
  });

  const server = new McpServer({
    name: "curviate-mcp",
    version: options.version,
  });

  registerAllTools(server, curviate);

  return server;
}
