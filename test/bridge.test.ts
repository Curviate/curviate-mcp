import { describe, expect, it, vi } from "vitest";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { FetchLike, Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";
import { createRemoteTransport, pipeTransports } from "../src/bridge.js";

function createFakeTransport(): Transport {
  return {
    start: vi.fn().mockResolvedValue(undefined),
    send: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  };
}

describe("pipeTransports", () => {
  it("forwards a local message to the remote transport", async () => {
    const local = createFakeTransport();
    const remote = createFakeTransport();
    pipeTransports(local, remote);

    const message = { jsonrpc: "2.0", id: 1, method: "tools/list" } as JSONRPCMessage;
    local.onmessage?.(message);

    await vi.waitFor(() => expect(remote.send).toHaveBeenCalledWith(message));
  });

  it("streams a remote response back to the local transport unchanged", async () => {
    const local = createFakeTransport();
    const remote = createFakeTransport();
    pipeTransports(local, remote);

    // A tool-level error is an ordinary JSON-RPC result whose content flags
    // isError: true. The bridge does zero translation, so relaying it
    // verbatim is also the error-passthrough behavior: nothing here special
    // cases error-shaped payloads.
    const response = {
      jsonrpc: "2.0",
      id: 1,
      result: { content: [{ type: "text", text: "boom" }], isError: true },
    } as JSONRPCMessage;
    remote.onmessage?.(response);

    await vi.waitFor(() => expect(local.send).toHaveBeenCalledWith(response));
  });

  it("synthesizes a JSON-RPC error response back to local when the remote send fails for a request", async () => {
    const local = createFakeTransport();
    const remote = createFakeTransport();
    (remote.send as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("network unreachable"));
    pipeTransports(local, remote, vi.fn());

    const request = {
      jsonrpc: "2.0",
      id: 42,
      method: "tools/call",
      params: { name: "get_account" },
    } as JSONRPCMessage;
    local.onmessage?.(request);

    await vi.waitFor(() => expect(local.send).toHaveBeenCalledTimes(1));
    const [sentResponse] = (local.send as ReturnType<typeof vi.fn>).mock.calls[0] as [JSONRPCMessage];
    expect(sentResponse).toMatchObject({
      jsonrpc: "2.0",
      id: 42,
      error: {
        code: expect.any(Number),
        message: expect.stringContaining("network unreachable"),
      },
    });
  });

  it("does not attempt to respond when forwarding a failed notification (no id to reply to)", async () => {
    const local = createFakeTransport();
    const remote = createFakeTransport();
    (remote.send as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("network unreachable"));
    pipeTransports(local, remote, vi.fn());

    const notification = { jsonrpc: "2.0", method: "notifications/initialized" } as JSONRPCMessage;
    local.onmessage?.(notification);

    await vi.waitFor(() => expect(remote.send).toHaveBeenCalledWith(notification));
    expect(local.send).not.toHaveBeenCalled();
  });

  it("propagates local close to remote close, and remote close to local close", async () => {
    const local = createFakeTransport();
    const remote = createFakeTransport();
    pipeTransports(local, remote);

    local.onclose?.();
    await vi.waitFor(() => expect(remote.close).toHaveBeenCalledTimes(1));

    remote.onclose?.();
    await vi.waitFor(() => expect(local.close).toHaveBeenCalledTimes(1));
  });

  it("logs transport errors from both sides via the injected logger", () => {
    const local = createFakeTransport();
    const remote = createFakeTransport();
    const logError = vi.fn();
    pipeTransports(local, remote, logError);

    const err = new Error("boom");
    local.onerror?.(err);
    remote.onerror?.(err);

    expect(logError).toHaveBeenCalledWith("local", err);
    expect(logError).toHaveBeenCalledWith("remote", err);
  });
});

describe("createRemoteTransport", () => {
  it("forwards a request to the hosted endpoint with the Bearer header and streams the response back unchanged", async () => {
    const calls: Array<[string | URL, RequestInit | undefined]> = [];
    const fakeFetch: FetchLike = async (url, init) => {
      calls.push([url, init]);
      const body = { jsonrpc: "2.0", id: 1, result: { tools: [] } };
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };

    const remote = createRemoteTransport({
      apiKey: "cvt_test_fake_key",
      mcpUrl: "https://app.staging.curviate.com/mcp",
      fetch: fakeFetch,
    });

    const received: JSONRPCMessage[] = [];
    remote.onmessage = (message) => received.push(message);

    await remote.start();
    await remote.send({ jsonrpc: "2.0", id: 1, method: "tools/list" } as JSONRPCMessage);

    expect(calls).toHaveLength(1);
    const [url, init] = calls[0]!;
    expect(String(url)).toBe("https://app.staging.curviate.com/mcp");
    expect(init?.method).toBe("POST");
    const headers = new Headers(init?.headers);
    expect(headers.get("authorization")).toBe("Bearer cvt_test_fake_key");
    expect(JSON.parse(String(init?.body))).toEqual({ jsonrpc: "2.0", id: 1, method: "tools/list" });

    // The response streamed back over the fake network reaches the caller
    // with no translation in between.
    expect(received).toEqual([{ jsonrpc: "2.0", id: 1, result: { tools: [] } }]);
  });

  it("propagates a hosted-endpoint HTTP failure as an error rather than swallowing it", async () => {
    const fakeFetch: FetchLike = async () => new Response("internal error", { status: 500 });
    const remote = createRemoteTransport({
      apiKey: "cvt_test_fake_key",
      mcpUrl: "https://app.staging.curviate.com/mcp",
      fetch: fakeFetch,
    });

    await remote.start();
    await expect(remote.send({ jsonrpc: "2.0", id: 1, method: "tools/list" } as JSONRPCMessage)).rejects.toThrow();
  });

  it("builds a real StreamableHTTPClientTransport pointed at mcpUrl when no fetch is injected", () => {
    const remote = createRemoteTransport({ apiKey: "cvt_test_fake_key", mcpUrl: "https://app.curviate.com/mcp" });
    expect(remote).toBeInstanceOf(StreamableHTTPClientTransport);
  });
});
