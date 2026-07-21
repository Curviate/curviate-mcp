/**
 * The bridge: forwards every JSON-RPC message between a local (stdio)
 * transport and the hosted Curviate MCP endpoint's remote transport.
 *
 * This is the entire product. There is no MCP semantic awareness here, no
 * per-method handling, no tool registry: `initialize`, `tools/list`,
 * `tools/call`, `ping`, `resources/*`, and every other method a client sends
 * is relayed byte-for-byte in both directions. The hosted server remains the
 * single source of truth for the tool surface, so the bridge auto-tracks it
 * with zero drift and ships no tool copy.
 */
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { FetchLike, Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { isJSONRPCRequest, type JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";

export interface RemoteTransportOptions {
  apiKey: string;
  mcpUrl: string;
  /** Injectable fetch, test-only seam (mirrors the SDK's own transport option). */
  fetch?: FetchLike;
}

/**
 * Build the client transport that talks to the hosted endpoint, authenticated
 * with the workspace API key as an `Authorization: Bearer` header. This is
 * the header form of the same `?token=` auth the hosted server also accepts;
 * a stdio bridge process is a non-browser, non-connector client, so the
 * header is the correct form here.
 */
export function createRemoteTransport(options: RemoteTransportOptions): StreamableHTTPClientTransport {
  return new StreamableHTTPClientTransport(new URL(options.mcpUrl), {
    requestInit: {
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
      },
    },
    ...(options.fetch !== undefined ? { fetch: options.fetch } : {}),
  });
}

function buildBridgeErrorResponse(message: JSONRPCMessage, err: unknown): JSONRPCMessage | undefined {
  if (!isJSONRPCRequest(message)) {
    // Notifications and responses have no id to reply to; there is nothing
    // to synthesize a response for, only somewhere to log the failure.
    return undefined;
  }
  const detail = err instanceof Error ? err.message : String(err);
  return {
    jsonrpc: "2.0",
    id: message.id,
    error: {
      code: -32000,
      message: `Bridge failed to reach the hosted Curviate MCP endpoint: ${detail}`,
    },
  };
}

/**
 * Wire a local transport (the stdio side, facing the MCP client) and a
 * remote transport (the hosted endpoint side) to forward every message
 * bidirectionally. Install this before calling `start()` on either
 * transport, per the `Transport` interface contract.
 */
export function pipeTransports(
  local: Transport,
  remote: Transport,
  logError: (source: "local" | "remote", err: unknown) => void = (source, err) => {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`curviate-mcp: ${source} transport error: ${message}\n`);
  },
): void {
  local.onmessage = (message) => {
    remote.send(message).catch((err: unknown) => {
      logError("remote", err);
      const errorResponse = buildBridgeErrorResponse(message, err);
      if (errorResponse !== undefined) {
        local.send(errorResponse).catch((sendErr: unknown) => logError("local", sendErr));
      }
    });
  };

  remote.onmessage = (message) => {
    local.send(message).catch((err: unknown) => logError("local", err));
  };

  local.onerror = (err) => logError("local", err);
  remote.onerror = (err) => logError("remote", err);

  local.onclose = () => {
    remote.close().catch((err: unknown) => logError("remote", err));
  };
  remote.onclose = () => {
    local.close().catch((err: unknown) => logError("local", err));
  };
}
