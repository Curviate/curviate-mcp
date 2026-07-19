/**
 * Follow tools, backed by the SDK's `users` resource.
 */
import type { Curviate } from "@curviate/sdk";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { runTool } from "../tool-result.js";

export function registerFollowingTools(server: McpServer, curviate: Curviate): void {
  server.registerTool(
    "follow_user",
    {
      title: "Follow a LinkedIn user",
      description:
        "Follow a LinkedIn member as the connected account. Following is one-directional and needs no " +
        "acceptance, unlike send_connection_request. If the target's profile is private, LinkedIn does not " +
        "allow a direct follow, so this sends a connection request instead and returns connect_request_sent " +
        "rather than failing.",
      inputSchema: {
        account_id: z.string().describe("The connected account id to follow from."),
        user_id: z.string().describe("The target member's provider id, public identifier, or profile URL."),
      },
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async ({ account_id, user_id }) => runTool(() => curviate.account(account_id).users.follow(user_id)),
  );

  server.registerTool(
    "unfollow_user",
    {
      title: "Unfollow a LinkedIn user",
      description:
        "Stop following a LinkedIn member. This never affects an existing connection or pending invitation, " +
        "it only removes the one-way follow, and does not notify the member. Calling this on a member the " +
        "account does not currently follow is a safe no-op that still returns success.",
      inputSchema: {
        account_id: z.string().describe("The connected account id to unfollow from."),
        user_id: z.string().describe("The target member's provider id, public identifier, or profile URL."),
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ account_id, user_id }) => runTool(() => curviate.account(account_id).users.unfollow(user_id)),
  );
}
