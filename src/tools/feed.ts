/**
 * Feed tool, backed by the SDK's `feed` resource.
 */
import type { Curviate } from "@curviate/sdk";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { runTool } from "../tool-result.js";

export function registerFeedTools(server: McpServer, curviate: Curviate): void {
  server.registerTool(
    "get_feed",
    {
      title: "Get the home feed",
      description:
        "Read the connected account's LinkedIn home feed, the raw material for deciding what to engage with. " +
        "The feed is an unbounded, reordering stream with no total count, walk it with the returned cursor until " +
        "cursor is null. When a cursor is supplied, sort is ignored.",
      inputSchema: {
        account_id: z.string().describe("The connected account id whose feed to read."),
        sort: z
          .enum(["recent", "relevant"])
          .optional()
          .describe("recent = reverse-chronological (default), relevant = LinkedIn's ranked feed."),
        limit: z.number().int().min(1).max(100).optional().describe("Results per page (1-100, default 20)."),
        cursor: z.string().optional().describe("Opaque pagination cursor from a prior response."),
      },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ account_id, ...params }) => runTool(() => curviate.account(account_id).feed.home(params)),
  );
}
