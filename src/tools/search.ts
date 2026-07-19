/**
 * Structured search tools, backed by the SDK's `search` resource.
 *
 * Every filter here is optional; omitting all of them runs an unfiltered
 * search. `limit`/`cursor`/`offset` are pagination controls, never part of
 * the filter body itself.
 */
import type { Curviate } from "@curviate/sdk";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { runTool } from "../tool-result.js";

const pagination = {
  limit: z.number().int().min(1).optional().describe("Max results per page."),
  cursor: z.string().optional().describe("Opaque pagination cursor from a prior response."),
  offset: z.number().int().min(0).optional().describe("Zero-based pagination offset."),
};

export function registerSearchTools(server: McpServer, curviate: Curviate): void {
  server.registerTool(
    "search_people",
    {
      title: "Search LinkedIn people",
      description:
        "Search for LinkedIn members with structured filters: keywords, industry, location, current/past company, " +
        "school, network distance, and more. Opaque filter ids (industry, location, company, school, service) come " +
        "from a prior lookup against LinkedIn's own filter vocabulary; pass free text via keywords instead when you " +
        "don't have an id.",
      inputSchema: {
        account_id: z.string().describe("The connected account id to search as."),
        keywords: z.string().optional().describe("Full-text keyword search across all profile fields."),
        advanced_keywords: z
          .object({
            first_name: z.string().optional(),
            last_name: z.string().optional(),
            title: z.string().optional(),
            company: z.string().optional(),
            school: z.string().optional(),
          })
          .optional()
          .describe("Keyword filters scoped to specific profile fields."),
        industry: z.array(z.string()).optional().describe("Opaque industry ids."),
        location: z.array(z.string()).optional().describe("Opaque location ids."),
        current_company: z.array(z.string()).optional().describe("Opaque current-company ids."),
        past_company: z.array(z.string()).optional().describe("Opaque past-company ids."),
        school: z.array(z.string()).optional().describe("Opaque school ids."),
        service: z.array(z.string()).optional().describe("Opaque service ids."),
        connections_of: z.array(z.string()).optional().describe("Filter to connections of the given member ids."),
        followers_of: z.array(z.string()).optional().describe("Filter to followers of the given member ids."),
        network_distance: z
          .array(z.union([z.literal(1), z.literal(2), z.literal(3)]))
          .optional()
          .describe("Filter by network distance: 1 = 1st degree, 2 = 2nd degree, 3 = 3rd degree."),
        profile_language: z.array(z.string()).optional().describe("Filter by profile language codes."),
        open_to_volunteering: z.boolean().optional().describe("Filter to profiles open to volunteering."),
        ...pagination,
      },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ account_id, limit, cursor, offset, ...body }) =>
      runTool(() => curviate.account(account_id).search.people({ ...body, ...(limit !== undefined ? { limit } : {}), ...(cursor !== undefined ? { cursor } : {}), ...(offset !== undefined ? { offset } : {}) })),
  );

  server.registerTool(
    "search_companies",
    {
      title: "Search LinkedIn companies",
      description:
        "Search for LinkedIn company pages with structured filters: keywords, industry, location, headcount " +
        "buckets, active job postings, and network distance. No company description, tagline, or mission is " +
        "returned; follow up with get_company for the full profile.",
      inputSchema: {
        account_id: z.string().describe("The connected account id to search as."),
        keywords: z.string().optional().describe("Full-text keyword search across company profiles."),
        industry: z.array(z.string()).optional().describe("Opaque industry ids."),
        location: z.array(z.string()).optional().describe("Opaque location ids."),
        has_job_postings: z.boolean().optional().describe("Filter to companies with active job postings."),
        headcount: z
          .array(z.object({ min: z.number(), max: z.number() }))
          .optional()
          .describe("Company-size buckets, e.g. { min: 51, max: 200 }."),
        network_distance: z
          .array(z.union([z.literal(1), z.literal(2), z.literal(3)]))
          .optional()
          .describe("Filter by network distance: 1 = 1st degree, 2 = 2nd degree, 3 = 3rd degree."),
        ...pagination,
      },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ account_id, limit, cursor, offset, ...body }) =>
      runTool(() => curviate.account(account_id).search.companies({ ...body, ...(limit !== undefined ? { limit } : {}), ...(cursor !== undefined ? { cursor } : {}), ...(offset !== undefined ? { offset } : {}) })),
  );

  server.registerTool(
    "search_posts",
    {
      title: "Search LinkedIn posts",
      description:
        "Search LinkedIn posts with structured filters: keywords, recency, content type, author, and mentions. " +
        "Use posted_by.me / posted_by.first_connections / posted_by.people_you_follow to scope to your own network " +
        "without resolving member ids.",
      inputSchema: {
        account_id: z.string().describe("The connected account id to search as."),
        keywords: z.string().optional().describe("Full-text keyword search in posts."),
        sort_by: z.enum(["relevance", "date"]).optional().describe("Sort order (default relevance)."),
        date_posted: z.enum(["past_day", "past_week", "past_month"]).optional().describe("Filter by post recency."),
        content_type: z
          .enum(["videos", "images", "live_videos", "collaborative_articles", "documents"])
          .optional()
          .describe("Filter by content type."),
        posted_by: z
          .object({
            member: z.array(z.string()).optional(),
            company: z.array(z.string()).optional(),
            me: z.boolean().optional(),
            first_connections: z.boolean().optional(),
            people_you_follow: z.boolean().optional(),
          })
          .optional()
          .describe("Filter to posts by specific authors."),
        mentioning: z
          .object({ member: z.array(z.string()).optional(), company: z.array(z.string()).optional() })
          .optional()
          .describe("Filter to posts mentioning specific members or companies."),
        author: z
          .object({
            industry: z.array(z.string()).optional(),
            company: z.array(z.string()).optional(),
            keywords: z.string().optional(),
          })
          .optional()
          .describe("Filter by author attributes."),
        ...pagination,
      },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ account_id, limit, cursor, offset, ...body }) =>
      runTool(() => curviate.account(account_id).search.posts({ ...body, ...(limit !== undefined ? { limit } : {}), ...(cursor !== undefined ? { cursor } : {}), ...(offset !== undefined ? { offset } : {}) })),
  );

  server.registerTool(
    "search_jobs",
    {
      title: "Search LinkedIn job postings",
      description:
        "Search LinkedIn job postings with structured filters: keywords, location, seniority, function, job type, " +
        "work arrangement, and more. Opaque ids (location, industry, company, role) come from a prior lookup " +
        "against LinkedIn's own filter vocabulary.",
      inputSchema: {
        account_id: z.string().describe("The connected account id to search as."),
        keywords: z.string().optional().describe("Full-text keyword search in job postings."),
        sort_by: z.enum(["relevance", "date"]).optional().describe("Sort order (default relevance)."),
        date_posted: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Jobs posted within N days, snapped up to the nearest supported window."),
        region: z.string().optional().describe("Opaque region id."),
        location: z.array(z.string()).optional().describe("Opaque location ids."),
        location_within_area: z
          .number()
          .optional()
          .describe("Search radius around the location, in kilometers (snapped to 0/8/16/40/80/160)."),
        industry: z.array(z.string()).optional().describe("Opaque industry ids."),
        seniority: z
          .array(z.enum(["executive", "director", "mid_senior", "associate", "entry", "intern"]))
          .optional()
          .describe("Filter by seniority level."),
        job_function: z
          .array(z.string())
          .optional()
          .describe("Job function slugs, lowercase (e.g. 'engineering'). Wire field: function."),
        role: z.array(z.string()).optional().describe("Opaque role ids."),
        job_type: z
          .array(z.enum(["full_time", "part_time", "contract", "temporary", "volunteer", "internship", "other"]))
          .optional()
          .describe("Filter by employment type."),
        company: z.array(z.string()).optional().describe("Opaque company ids."),
        presence: z.array(z.enum(["remote", "hybrid", "on_site"])).optional().describe("Filter by work arrangement."),
        easy_apply: z.boolean().optional().describe("Filter to jobs with LinkedIn Easy Apply enabled."),
        under_10_applicants: z.boolean().optional().describe("Filter to jobs with fewer than 10 applicants."),
        in_your_network: z.boolean().optional().describe("Filter to jobs at companies in your network."),
        benefits: z.array(z.string()).optional().describe("Filter by offered benefits."),
        commitments: z.array(z.string()).optional().describe("Filter by company commitments."),
        has_verifications: z.boolean().optional().describe("Filter to jobs with LinkedIn verification badges."),
        fair_chance_employer: z.boolean().optional().describe("Filter to fair-chance employers."),
        ...pagination,
      },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ account_id, limit, cursor, offset, job_function, ...body }) =>
      runTool(() =>
        curviate.account(account_id).search.jobs({
          ...body,
          ...(job_function !== undefined ? { function: job_function } : {}),
          ...(limit !== undefined ? { limit } : {}),
          ...(cursor !== undefined ? { cursor } : {}),
          ...(offset !== undefined ? { offset } : {}),
        }),
      ),
  );
}
