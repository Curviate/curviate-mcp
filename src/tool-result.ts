/**
 * Shared tool-execution wrapper.
 *
 * Every tool's execution is a single typed `@curviate/sdk` call. This helper
 * runs that call and converts the outcome into an MCP `CallToolResult`:
 * success serializes the response as JSON text; failure surfaces the SDK's
 * structured `CurviateError` verbatim (already a clean, public error body)
 * with `isError: true`, so a calling agent can branch on `code` without any
 * translation layer in between.
 */
import { isCurviateError } from "@curviate/sdk";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export async function runTool<T>(fn: () => Promise<T>): Promise<CallToolResult> {
  try {
    const result = await fn();
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  } catch (err) {
    if (isCurviateError(err)) {
      return {
        isError: true,
        content: [{ type: "text", text: JSON.stringify(err.toJSON(), null, 2) }],
      };
    }
    const message = err instanceof Error ? err.message : String(err);
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: JSON.stringify({ name: "CurviateError", code: "INTERNAL", message }, null, 2),
        },
      ],
    };
  }
}
