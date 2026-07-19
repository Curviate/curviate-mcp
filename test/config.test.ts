import { describe, expect, it, vi } from "vitest";
import { resolveServerConfig } from "../src/config.js";

describe("resolveServerConfig", () => {
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

  it("resolves baseUrl from CURVIATE_BASE_URL", () => {
    const config = resolveServerConfig([], { CURVIATE_API_KEY: "env_key", CURVIATE_BASE_URL: "https://staging.example.com" }, vi.fn());
    expect(config.baseUrl).toBe("https://staging.example.com");
  });

  it("resolves baseUrl from --base-url when the env var is absent", () => {
    const config = resolveServerConfig(
      ["--api-key", "k", "--base-url", "https://staging.example.com"],
      {},
      vi.fn(),
    );
    expect(config.baseUrl).toBe("https://staging.example.com");
  });

  it("leaves baseUrl undefined when neither source is given", () => {
    const config = resolveServerConfig([], { CURVIATE_API_KEY: "env_key" }, vi.fn());
    expect(config.baseUrl).toBeUndefined();
  });
});
