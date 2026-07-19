/**
 * Notification tools, backed by the SDK's `notifications` resource.
 */
import type { Curviate } from "@curviate/sdk";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { runTool } from "../tool-result.js";

const NOTIFICATION_FILTERS = [
  "all",
  "jobs",
  "mentions",
  "my_posts",
  "my_posts_comments",
  "my_posts_reactions",
  "my_posts_reposts",
] as const;

export function registerNotificationTools(server: McpServer, curviate: Curviate): void {
  server.registerTool(
    "list_notifications",
    {
      title: "List notifications",
      description:
        "List the connected account's LinkedIn notification cards, newest first, plus the unread badge count. " +
        "Filter to one stream with filter, defaulting to all. Each item carries a card_urn for chaining into " +
        "dismiss_notification.",
      inputSchema: {
        account_id: z.string().describe("The connected account id whose notifications to list."),
        filter: z.enum(NOTIFICATION_FILTERS).optional().describe("Which notification stream to read. Defaults to all."),
        limit: z.number().int().min(1).max(100).optional().describe("Results per page (1-100, default 20)."),
        cursor: z.string().optional().describe("Opaque pagination cursor from a prior response."),
      },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ account_id, ...params }) => runTool(() => curviate.account(account_id).notifications.list(params)),
  );

  server.registerTool(
    "dismiss_notification",
    {
      title: "Delete or show-less a notification",
      description:
        "Delete one of the connected account's own notification cards, or apply LinkedIn's show less like " +
        "this to it, chosen by mode. For network-activity cards (a repost, comment, or reaction by your " +
        "network) show_less has the same effect as delete, since LinkedIn exposes no separate softer signal " +
        "for those cards. This is a self-action, no third party is notified, and it cannot be undone either way.",
      inputSchema: {
        account_id: z.string().describe("The connected account id whose notification to dismiss."),
        card_urn: z
          .string()
          .describe("The card_urn field of a list_notifications item, not object_urn, which targets the wrong notification."),
        mode: z
          .enum(["delete", "show_less"])
          .describe("delete removes the card outright; show_less applies LinkedIn's show less like this."),
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ account_id, card_urn, mode }) => {
      const acc = curviate.account(account_id);
      if (mode === "show_less") {
        return runTool(() => acc.notifications.showLess(card_urn));
      }
      return runTool(() => acc.notifications.delete(card_urn));
    },
  );
}
