/**
 * Group-member tool, backed by the SDK's `groups` resource.
 */
import type { Curviate } from "@curviate/sdk";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { runTool } from "../tool-result.js";

export function registerGroupTools(server: McpServer, curviate: Curviate): void {
  server.registerTool(
    "list_group_members",
    {
      title: "List a group's members",
      description:
        "List the members of a LinkedIn group, cursor-paginated, each carrying its profile URL, name, and " +
        "headline. Pass name to search the roster by member name instead of listing the full roster. Use " +
        "search_groups first to find the group's id. Member ids chain into get_profile or " +
        "send_connection_request with no extra lookup.",
      inputSchema: {
        account_id: z.string().describe("The connected account id to read as."),
        group: z.string().describe("The group's numeric id or LinkedIn group URL."),
        name: z.string().optional().describe("Filter the roster by member name (prefix or substring, case-insensitive)."),
        limit: z.number().int().min(1).max(100).optional().describe("Results per page (1-100, default 20)."),
        cursor: z.string().optional().describe("Opaque pagination cursor from a prior response."),
      },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ account_id, group, ...params }) => runTool(() => curviate.account(account_id).groups.members(group, params)),
  );
}
