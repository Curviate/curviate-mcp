/**
 * Company-lookup tool, backed by the SDK's `companies` resource.
 */
import type { Curviate } from "@curviate/sdk";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { runTool } from "../tool-result.js";

export function registerCompanyTools(server: McpServer, curviate: Curviate): void {
  server.registerTool(
    "get_company",
    {
      title: "Get a LinkedIn company",
      description:
        "Retrieve a LinkedIn company page's full profile: description, tagline, headcount, industry, and " +
        "location. Accepts the public handle (the slug in linkedin.com/company/<handle>) or a numeric company id.",
      inputSchema: {
        account_id: z.string().describe("The connected account id to look up as."),
        identifier: z.string().describe("The company's public handle (e.g. \"t-systems\") or numeric id."),
      },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ account_id, identifier }) => runTool(() => curviate.account(account_id).companies.get(identifier)),
  );
}
