/**
 * Account-management tools: list and inspect the tenant's connected LinkedIn
 * accounts. Root-scoped (no `account_id` input) since these read the
 * connected-account inventory itself, not a resource that lives inside one.
 */
import type { Curviate } from "@curviate/sdk";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { runTool } from "../tool-result.js";

export function registerAccountTools(server: McpServer, curviate: Curviate): void {
  server.registerTool(
    "list_accounts",
    {
      title: "List connected accounts",
      description:
        "List the tenant's connected LinkedIn accounts, cursor-paginated. Each item carries the account id " +
        "you pass to every other tool as account_id, plus cached profile fields populated by background " +
        "enrichment. Use this first to discover which accounts are available to act as.",
      inputSchema: {
        limit: z.number().int().min(1).max(250).optional().describe("Max accounts per page (1-250)."),
        cursor: z.string().optional().describe("Opaque pagination cursor from a prior response."),
      },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ limit, cursor }) =>
      runTool(() =>
        curviate.accounts.list({
          ...(limit !== undefined ? { limit } : {}),
          ...(cursor !== undefined ? { cursor } : {}),
        }),
      ),
  );

  server.registerTool(
    "get_account",
    {
      title: "Get a connected account",
      description:
        "Retrieve metadata and current state for one connected LinkedIn account, including its quota usage " +
        "across all tracked quota families and the seat it occupies. This is a stale-while-revalidate read: " +
        "it always returns immediately from the cached row, never blocking on a live LinkedIn call.",
      inputSchema: {
        account_id: z.string().describe("The connected account id, from list_accounts."),
      },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ account_id }) => runTool(() => curviate.accounts.get(account_id)),
  );
}
