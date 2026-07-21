/**
 * Bin entry point: resolve config from the environment (with CLI-flag
 * fallbacks), wire a stdio transport to the hosted MCP endpoint, and forward
 * messages between them until either side closes.
 *
 * The shebang banner is injected by tsup's build config, not written here.
 */
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createRemoteTransport, pipeTransports } from "./bridge.js";
import { resolveServerConfig } from "./config.js";

// Read version from package.json at runtime (single source of truth).
const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const pkg = require(resolve(__dirname, "../package.json")) as { version: string };

async function main(): Promise<void> {
  const config = resolveServerConfig(process.argv.slice(2), process.env);

  process.stderr.write(`curviate-mcp bridge v${pkg.version} connecting to ${config.mcpUrl}\n`);

  const local = new StdioServerTransport();
  const remote = createRemoteTransport({ apiKey: config.apiKey, mcpUrl: config.mcpUrl });

  // Install the forwarding callbacks before starting either transport, per
  // the Transport interface contract (callbacks first, or messages may be
  // lost).
  pipeTransports(local, remote);

  await remote.start();
  await local.start();
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`curviate-mcp failed to start: ${message}\n`);
  process.exit(1);
});
