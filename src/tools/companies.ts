/**
 * Company tools, backed by the SDK's `companies` resource.
 */
import type { Curviate } from "@curviate/sdk";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { runTool } from "../tool-result.js";

const BROWSE_SECTIONS = ["employees", "posts", "jobs", "followers", "invitable_followers"] as const;

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

  server.registerTool(
    "browse_company",
    {
      title: "Browse a company page's employees, posts, jobs, or followers",
      description:
        "List one view of a company page, selected with section: employees, posts, or jobs (any connected " +
        "account), or followers and invitable_followers (the connected account must administer the page, " +
        "else a 403). identifier must be the company's numeric id, as returned by get_company. Use get_company " +
        "for the page's own profile fields instead of a listing.",
      inputSchema: {
        account_id: z.string().describe("The connected account id to browse as."),
        identifier: z.string().describe("The company's numeric id, as returned by get_company or list_managed_companies."),
        section: z
          .enum(BROWSE_SECTIONS)
          .describe(
            "Which view to browse: employees, posts, or jobs (any connected account); followers or invitable_followers (the account must administer this page).",
          ),
        keywords: z.string().optional().describe("Free-text keyword filter (employees and jobs sections only)."),
        location: z.string().optional().describe("Opaque location id (employees section only)."),
        limit: z.number().int().min(1).max(100).optional().describe("Results per page, default varies by section."),
        cursor: z.string().optional().describe("Opaque pagination cursor from a prior response."),
      },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ account_id, identifier, section, keywords, location, limit, cursor }) => {
      const acc = curviate.account(account_id);
      const page = { ...(limit !== undefined ? { limit } : {}), ...(cursor !== undefined ? { cursor } : {}) };

      switch (section) {
        case "employees":
          return runTool(() =>
            acc.companies.employees(identifier, {
              ...page,
              ...(keywords !== undefined ? { keywords } : {}),
              ...(location !== undefined ? { location } : {}),
            }),
          );
        case "posts":
          return runTool(() => acc.companies.posts(identifier, page));
        case "jobs":
          return runTool(() => acc.companies.jobs(identifier, { ...page, ...(keywords !== undefined ? { keywords } : {}) }));
        case "followers":
          return runTool(() => acc.companies.followers(identifier, page));
        case "invitable_followers":
          return runTool(() => acc.companies.invitableFollowers(identifier, page));
      }
    },
  );

  server.registerTool(
    "list_managed_companies",
    {
      title: "List company pages the account administers",
      description:
        "List the LinkedIn company pages the connected account administers. The returned ids feed " +
        "browse_company's followers and invitable_followers sections. An empty list is valid, the account " +
        "administers no pages.",
      inputSchema: {
        account_id: z.string().describe("The connected account id whose administered pages to list."),
        limit: z.number().int().min(1).max(100).optional().describe("Results per page (default 10)."),
        cursor: z.string().optional().describe("Opaque pagination cursor from a prior response."),
      },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ account_id, ...params }) => runTool(() => curviate.account(account_id).companies.managed(params)),
  );
}
