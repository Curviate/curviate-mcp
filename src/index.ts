/**
 * Bin entry point: resolve config from the environment (with a CLI-flag
 * fallback for the API key), build the server, and serve MCP over stdio.
 *
 * The shebang banner is injected by tsup's build config, not written here.
 */
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { resolveServerConfig } from "./config.js";
import { createServer } from "./server.js";

// Read version from package.json at runtime (single source of truth).
const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const pkg = require(resolve(__dirname, "../package.json")) as { version: string };

async function main(): Promise<void> {
  const config = resolveServerConfig(process.argv.slice(2), process.env);
  const server = createServer({
    apiKey: config.apiKey,
    baseUrl: config.baseUrl,
    version: pkg.version,
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`curviate-mcp failed to start: ${message}\n`);
  process.exit(1);
});
