import { describe, expect, it, vi } from "vitest";
import { DEFAULT_MCP_URL, resolveServerConfig } from "../src/config.js";

describe("resolveServerConfig", () => {
  describe("apiKey", () => {
    it("prefers CURVIATE_API_KEY over --api-key when both are present", () => {
      const warn = vi.fn();
      const config = resolveServerConfig(["--api-key", "flag_key"], { CURVIATE_API_KEY: "env_key" }, warn);
      expect(config.apiKey).toBe("env_key");
      expect(warn).not.toHaveBeenCalled();
    });

    it("falls back to --api-key and warns when CURVIATE_API_KEY is absent", () => {
      const warn = vi.fn();
      const config = resolveServerConfig(["--api-key", "flag_key"], {}, warn);
      expect(config.apiKey).toBe("flag_key");
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0]?.[0]).toMatch(/CURVIATE_API_KEY/);
    });

    it("supports the --api-key=value form", () => {
      const warn = vi.fn();
      const config = resolveServerConfig(["--api-key=flag_key"], {}, warn);
      expect(config.apiKey).toBe("flag_key");
    });

    it("throws a user-actionable error when no API key is resolvable", () => {
      expect(() => resolveServerConfig([], {}, vi.fn())).toThrow(/CURVIATE_API_KEY/);
    });

    it("treats an empty-string env var as absent and falls through to the flag", () => {
      const warn = vi.fn();
      const config = resolveServerConfig(["--api-key", "flag_key"], { CURVIATE_API_KEY: "" }, warn);
      expect(config.apiKey).toBe("flag_key");
    });
  });

  describe("mcpUrl", () => {
    it("defaults to the production hosted endpoint when neither source is given", () => {
      const config = resolveServerConfig([], { CURVIATE_API_KEY: "env_key" }, vi.fn());
      expect(config.mcpUrl).toBe(DEFAULT_MCP_URL);
      expect(config.mcpUrl).toBe("https://app.curviate.com/mcp");
    });

    it("resolves mcpUrl from CURVIATE_MCP_URL", () => {
      const config = resolveServerConfig(
        [],
        { CURVIATE_API_KEY: "env_key", CURVIATE_MCP_URL: "https://app.staging.curviate.com/mcp" },
        vi.fn(),
      );
      expect(config.mcpUrl).toBe("https://app.staging.curviate.com/mcp");
    });

    it("resolves mcpUrl from --mcp-url when the env var is absent", () => {
      const config = resolveServerConfig(
        ["--api-key", "k", "--mcp-url", "https://app.staging.curviate.com/mcp"],
        {},
        vi.fn(),
      );
      expect(config.mcpUrl).toBe("https://app.staging.curviate.com/mcp");
    });

    it("supports the --mcp-url=value form", () => {
      const config = resolveServerConfig(
        ["--api-key", "k", "--mcp-url=https://app.staging.curviate.com/mcp"],
        {},
        vi.fn(),
      );
      expect(config.mcpUrl).toBe("https://app.staging.curviate.com/mcp");
    });

    it("prefers CURVIATE_MCP_URL over --mcp-url when both are present", () => {
      const config = resolveServerConfig(
        ["--api-key", "k", "--mcp-url", "https://flag.example.com/mcp"],
        { CURVIATE_MCP_URL: "https://env.example.com/mcp" },
        vi.fn(),
      );
      expect(config.mcpUrl).toBe("https://env.example.com/mcp");
    });

    it("treats an empty-string CURVIATE_MCP_URL as absent and falls through to the default", () => {
      const config = resolveServerConfig([], { CURVIATE_API_KEY: "env_key", CURVIATE_MCP_URL: "" }, vi.fn());
      expect(config.mcpUrl).toBe(DEFAULT_MCP_URL);
    });
  });
});
