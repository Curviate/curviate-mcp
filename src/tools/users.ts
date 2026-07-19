/**
 * Profile-lookup tool, backed by the SDK's `users` resource.
 */
import type { Curviate } from "@curviate/sdk";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { runTool } from "../tool-result.js";

const LINKEDIN_SECTIONS = [
  "linkedin_experience",
  "linkedin_education",
  "linkedin_languages",
  "linkedin_skills",
  "linkedin_certifications",
  "linkedin_volunteer_experience",
  "linkedin_projects",
  "linkedin_recommendations",
  "linkedin_interests",
] as const;

export function registerUserTools(server: McpServer, curviate: Curviate): void {
  server.registerTool(
    "get_profile",
    {
      title: "Get a LinkedIn profile",
      description:
        "Retrieve a LinkedIn member's profile, acting as the given connected account. Pass user_id \"me\" for " +
        "the connected account's own profile, or another member's public identifier, member id, or profile URL " +
        "for a read-only lookup. Request enriched sections (experience, education, skills, and similar) with " +
        "linkedin_sections; omit it for base fields only.",
      inputSchema: {
        account_id: z.string().describe("The connected account id to act as."),
        user_id: z
          .string()
          .describe('"me" for the connected account itself, or a target member\'s public identifier, member id, or profile URL.'),
        linkedin_sections: z
          .array(z.enum(LINKEDIN_SECTIONS))
          .optional()
          .describe("Additional profile sections to include. Omit for base fields only."),
      },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ account_id, user_id, linkedin_sections }) =>
      runTool(() =>
        curviate.account(account_id).users.get(user_id, {
          ...(linkedin_sections !== undefined ? { linkedin_sections } : {}),
        }),
      ),
  );
}
