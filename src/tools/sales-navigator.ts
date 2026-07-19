/**
 * Sales Navigator tools, backed by the SDK's `salesNavigator` resource.
 * Requires a Sales Navigator seat on the connected account; a seat-less
 * account gets a structured TIER_NOT_ACTIVE error, not a silent downgrade.
 * Use the sibling Core tool (search_people, get_profile, start_chat) when
 * you do not have a Sales Navigator seat.
 *
 * Most id-bearing filters take an already-resolved opaque parameter id (or
 * an { include, exclude } object of ids), the same convention as Core's
 * search tools. This package does not resolve free-text names to ids.
 */
import type { Curviate } from "@curviate/sdk";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { runTool } from "../tool-result.js";

const includeExclude = z
  .object({
    include: z.array(z.string()).optional(),
    exclude: z.array(z.string()).optional(),
  })
  .describe("Opaque parameter ids to include and/or exclude. Both arrays are optional.");

const rangeBucket = z.object({ min: z.number(), max: z.number() });

const postalCodeFilter = z
  .object({
    include: z.array(z.string()).optional(),
    exclude: z.array(z.string()).optional(),
    radius: z
      .union([z.literal(1), z.literal(5), z.literal(10), z.literal(25), z.literal(35), z.literal(50), z.literal(75), z.literal(100)])
      .optional()
      .describe("Search radius in miles: 1, 5, 10, 25, 35, 50, 75, or 100."),
  })
  .describe("Postal-code ids to include or exclude, plus an optional radius in miles.");

const SN_SENIORITY_VALUES = [
  "OWNER/PARTNER",
  "CXO",
  "VICE_PRESIDENT",
  "DIRECTOR",
  "EXPERIENCED_MANAGER",
  "ENTRY_LEVEL_MANAGER",
  "STRATEGIC",
  "SENIOR",
  "ENTRY_LEVEL",
  "IN_TRAINING",
] as const;

const SN_COMPANY_TYPE_VALUES = [
  "PUBLIC_COMPANY",
  "PRIVATELY_HELD",
  "NON_PROFIT",
  "EDUCATIONAL_INSTITUTION",
  "PARTNERSHIP",
  "SELF_EMPLOYED",
  "SELF_OWNED",
  "GOVERNMENT_AGENCY",
] as const;

const saveSearch = z.object({ name: z.string().min(1) }).describe("Save this search under a name for later retrieval.");
const loadSavedSearch = z
  .object({ id: z.string(), last_viewed_at: z.number().int().optional() })
  .describe("Load and run a previously saved search by id.");
const loadRecentSearch = z.object({ id: z.string() }).describe("Load and run a recent search by id.");

const SN_WITH_SECTIONS_BASE = [
  "linkedin_*",
  "linkedin_experience",
  "linkedin_education",
  "linkedin_languages",
  "linkedin_skills",
  "linkedin_certifications",
  "linkedin_volunteer_experience",
  "linkedin_projects",
  "linkedin_recommendations",
  "linkedin_interests",
  "linkedin_recruiting_activity",
] as const;
const SN_WITH_SECTIONS_VALUES = [
  ...SN_WITH_SECTIONS_BASE,
  ...SN_WITH_SECTIONS_BASE.map((s) => `${s}_preview` as const),
] as const;

const withSectionsField = z
  .array(z.enum(SN_WITH_SECTIONS_VALUES))
  .optional()
  .describe(
    "Which profile sections to fetch. One or more of linkedin_*, linkedin_experience, linkedin_education, " +
      "linkedin_languages, linkedin_skills, linkedin_certifications, linkedin_volunteer_experience, " +
      "linkedin_projects, linkedin_recommendations, linkedin_interests, linkedin_recruiting_activity, and the " +
      "_preview variant of each. Omit for base fields only.",
  );

const snChatAttachment = z.object({
  content: z.string().describe("Base64-encoded file bytes."),
  content_type: z.string().describe("Attachment MIME type (e.g. image/png, audio/mp4)."),
  filename: z.string().describe("File name for the attachment."),
  send_mode: z
    .enum(["file", "native"])
    .optional()
    .describe("'file' (default) for a normal attachment, 'native' for a platform-native voice/video bubble."),
  metadata: z
    .object({ duration: z.number().int().nonnegative().optional().describe("Duration in milliseconds.") })
    .optional()
    .describe("Required duration when send_mode is native."),
});

const pagination100 = {
  limit: z.number().int().min(1).max(100).optional().describe("Results per page (1-100, default 25)."),
  cursor: z.string().optional().describe("Opaque pagination cursor from a prior response."),
};

export function registerSalesNavigatorTools(server: McpServer, curviate: Curviate): void {
  server.registerTool(
    "sn_search_people",
    {
      title: "Search people on Sales Navigator",
      description:
        "Search LinkedIn members using Sales Navigator's richer filter set: current/past company, job title, " +
        "seniority, years of experience, saved lists, and more. Most id-bearing filters take an " +
        "{ include, exclude } object of opaque parameter ids; persona and profile_language take a plain array " +
        "of ids directly. Requires a Sales Navigator seat, use search_people instead if you do not have one.",
      inputSchema: {
        account_id: z.string().describe("The connected account id to search as."),
        keywords: z.string().optional().describe("Free-text keyword filter."),
        current_company: includeExclude.optional().describe("Current-employer company ids to include or exclude."),
        past_company: includeExclude.optional().describe("Past-employer company ids to include or exclude."),
        company_location: includeExclude.optional().describe("Location ids for the current company's HQ to include or exclude."),
        account_list: includeExclude.optional().describe("Saved account-list ids to include or exclude."),
        function: includeExclude.optional().describe("Job-function ids to include or exclude."),
        current_job_title: includeExclude.optional().describe("Current-role job-title ids to include or exclude."),
        past_job_title: includeExclude.optional().describe("Past-role job-title ids to include or exclude."),
        persona: z.array(z.string()).optional().describe("Persona ids to filter by."),
        location: includeExclude.optional().describe("Location ids to include or exclude."),
        postal_code: postalCodeFilter.optional(),
        industry: includeExclude.optional().describe("Industry ids to include or exclude."),
        group: includeExclude.optional().describe("LinkedIn group ids to include or exclude."),
        school: includeExclude.optional().describe("School ids to include or exclude."),
        profile_language: z.array(z.string()).optional().describe("Profile-language ids to filter by."),
        lead_list: includeExclude.optional().describe("Saved lead-list ids to include or exclude."),
        seniority: z
          .object({ include: z.array(z.enum(SN_SENIORITY_VALUES)).optional(), exclude: z.array(z.enum(SN_SENIORITY_VALUES)).optional() })
          .optional()
          .describe("Seniority levels to include or exclude."),
        company_headcount: z.array(rangeBucket).optional().describe("Company headcount ranges."),
        years_in_company: z.array(rangeBucket).optional().describe("Years-in-current-company ranges."),
        years_in_position: z.array(rangeBucket).optional().describe("Years-in-current-position ranges."),
        years_of_experience: z.array(rangeBucket).optional().describe("Total years-of-experience ranges."),
        company_type: z.array(z.enum(SN_COMPANY_TYPE_VALUES)).optional().describe("Company type filter."),
        network_distance: z
          .array(z.union([z.literal(1), z.literal(2), z.literal(3), z.literal("GROUP")]))
          .optional()
          .describe("Connection distance: 1 (1st), 2 (2nd), 3 (3rd+), or GROUP (group members)."),
        connections_of: z.array(z.string()).optional().describe("Filter to connections of these member ids."),
        first_name: z.array(z.string()).optional().describe("First names to filter by."),
        last_name: z.array(z.string()).optional().describe("Last names to filter by."),
        recent_interaction: z
          .object({ viewed_profile: z.boolean().optional(), messaged: z.boolean().optional() })
          .optional()
          .describe("Filter by recent interaction with the operator account."),
        saved_resources: z
          .object({ saved_leads: z.boolean().optional(), saved_accounts: z.boolean().optional() })
          .optional()
          .describe("Include results from the operator's saved leads/accounts."),
        save_search: saveSearch.optional(),
        load_saved_search: loadSavedSearch.optional(),
        load_recent_search: loadRecentSearch.optional(),
        following_your_company: z.boolean().optional().describe("Filter to members following your company."),
        viewed_your_profile_recently: z.boolean().optional().describe("Filter to members who viewed your profile recently."),
        past_colleague: z.boolean().optional().describe("Filter to past colleagues."),
        shared_experiences: z.boolean().optional().describe("Filter to members with shared experiences."),
        changed_jobs: z.boolean().optional().describe("Filter to members who recently changed jobs."),
        posted_on_linkedin: z.boolean().optional().describe("Filter to members who recently posted on LinkedIn."),
        ...pagination100,
      },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ account_id, limit, cursor, ...body }) =>
      runTool(() =>
        curviate.account(account_id).salesNavigator.searchPeople(body, {
          ...(limit !== undefined ? { limit } : {}),
          ...(cursor !== undefined ? { cursor } : {}),
        }),
      ),
  );

  server.registerTool(
    "sn_search_companies",
    {
      title: "Search companies on Sales Navigator",
      description:
        "Search LinkedIn companies using Sales Navigator's richer filter set: industry, location, headcount, " +
        "revenue, growth, and activity spotlights. Most id-bearing filters take an { include, exclude } object " +
        "of opaque parameter ids. department_headcount and department_headcount_growth each take a single " +
        "department id (not an array). Requires a Sales Navigator seat, use search_companies instead if you do " +
        "not have one.",
      inputSchema: {
        account_id: z.string().describe("The connected account id to search as."),
        keywords: z.string().optional().describe("Free-text keyword filter."),
        annual_revenue: z
          .object({
            min: z.number().optional().describe("Minimum annual revenue, in millions."),
            max: z.number().optional().describe("Maximum annual revenue, in millions."),
            currency: z.string().length(3).describe("ISO-4217 three-character currency code, e.g. USD."),
          })
          .optional()
          .describe("Annual revenue range."),
        headcount: z.array(rangeBucket).optional().describe("Company headcount ranges."),
        followers: z.array(rangeBucket).optional().describe("Follower-count ranges."),
        fortune: z.array(rangeBucket).optional().describe("Fortune ranking ranges."),
        headcount_growth: z.object({ min: z.number(), max: z.number() }).optional().describe("Headcount growth percentage range."),
        department_headcount: z
          .object({ department: z.string().describe("A single job-function id."), min: z.number(), max: z.number() })
          .optional()
          .describe("Filter by department headcount. department, min, and max are all required together."),
        department_headcount_growth: z
          .object({ department: z.string().describe("A single job-function id."), min: z.number(), max: z.number() })
          .optional()
          .describe("Filter by department headcount growth. department, min, and max are all required together."),
        location: includeExclude.optional().describe("Location ids to include or exclude."),
        postal_code: includeExclude.optional().describe("Postal-code ids to include or exclude (no radius for companies)."),
        industry: includeExclude.optional().describe("Industry ids to include or exclude."),
        account_list: includeExclude.optional().describe("Saved account-list ids to include or exclude."),
        spotlights: z
          .array(z.enum(["HIRING_ON_LINKEDIN", "RECENT_LEADERSHIP_CHANGE", "RECENT_FUNDING_EVENTS", "FIRST_DEGREE_CONNECTIONS"]))
          .optional()
          .describe("Company activity spotlights to filter by."),
        saved_accounts: z.boolean().optional().describe("Filter to the operator's saved accounts."),
        save_search: saveSearch.optional(),
        load_saved_search: loadSavedSearch.optional(),
        load_recent_search: loadRecentSearch.optional(),
        ...pagination100,
      },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ account_id, limit, cursor, ...body }) =>
      runTool(() =>
        curviate.account(account_id).salesNavigator.searchCompanies(body, {
          ...(limit !== undefined ? { limit } : {}),
          ...(cursor !== undefined ? { cursor } : {}),
        }),
      ),
  );

  server.registerTool(
    "sn_search_from_url",
    {
      title: "Search Sales Navigator from a pasted URL",
      description:
        "Run a pasted Sales Navigator search, saved-search, or lead-list URL directly instead of building " +
        "structured filters yourself. url is the only accepted field. Each result item is discriminated " +
        "individually by its own kind, so a single call can return a mix of kinds. Requires a Sales Navigator " +
        "seat, use search_from_url instead if you do not have one.",
      inputSchema: {
        account_id: z.string().describe("The connected account id to search as."),
        url: z.string().describe("A pasted Sales Navigator search, saved-search, or lead-list URL."),
        limit: z.number().int().min(1).max(50).optional().describe("Results per page (1-50, default 10)."),
        cursor: z.string().optional().describe("Opaque pagination cursor from a prior response."),
      },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ account_id, url, limit, cursor }) =>
      runTool(() =>
        curviate.account(account_id).salesNavigator.searchFromUrl({
          url,
          ...(limit !== undefined ? { limit } : {}),
          ...(cursor !== undefined ? { cursor } : {}),
        }),
      ),
  );

  server.registerTool(
    "sn_get_profile",
    {
      title: "Get a profile with Sales Navigator enrichment",
      description:
        "Fetch a LinkedIn profile with Sales Navigator enrichment (is_saved_lead, is_crm_imported, and other " +
        "Sales Navigator specifics), optionally selecting sections with with_sections. Chains into sn_start_chat " +
        "or sn_save_lead with the returned id. Requires a Sales Navigator seat, use get_profile instead if you " +
        "do not have one.",
      inputSchema: {
        account_id: z.string().describe("The connected account id to look up as."),
        identifier: z.string().describe("'me', a public identifier, a profile URL, or a member id."),
        with_sections: withSectionsField,
      },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ account_id, identifier, with_sections }) =>
      runTool(() =>
        curviate.account(account_id).salesNavigator.getProfile(identifier, with_sections !== undefined ? { with_sections } : undefined),
      ),
  );

  server.registerTool(
    "sn_start_chat",
    {
      title: "Start a chat (Sales Navigator)",
      description:
        "Start a new Sales Navigator InMail-style chat with one or more members and send the opening message " +
        "in the same call. subject is required, reflecting Sales Navigator's InMail-based messaging (unlike " +
        "Core's start_chat, where it is optional). Requires a Sales Navigator seat.",
      inputSchema: {
        account_id: z.string().describe("The connected account id to send from."),
        attendees_ids: z.array(z.string()).min(1).describe("Sales Navigator member ids for the chat recipients."),
        text: z.string().min(1).max(8000).describe("Opening message text (1-8000 chars)."),
        subject: z.string().min(1).max(200).describe("Subject line, required for Sales Navigator InMail-based messaging."),
        attachments: z.array(snChatAttachment).optional().describe("Optional file, voice, or video attachments."),
      },
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async ({ account_id, ...body }) => runTool(() => curviate.account(account_id).salesNavigator.startChat(body)),
  );

  server.registerTool(
    "sn_list_lists",
    {
      title: "List Sales Navigator account lists or lead lists",
      description:
        "List the operator's saved Sales Navigator lists: account_lists (saved companies) or lead_lists (saved " +
        "members), chosen with type. List ids chain into sn_save_account and sn_save_lead. Requires a Sales " +
        "Navigator seat.",
      inputSchema: {
        account_id: z.string().describe("The connected account id whose lists to read."),
        type: z.enum(["account_lists", "lead_lists"]).describe("Which list type to list."),
        limit: z.number().int().min(1).max(100).optional().describe("Results per page (1-100, default 10)."),
        cursor: z.string().optional().describe("Opaque pagination cursor from a prior response."),
      },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ account_id, type, ...params }) => {
      const acc = curviate.account(account_id);
      return type === "account_lists" ? runTool(() => acc.salesNavigator.accountLists(params)) : runTool(() => acc.salesNavigator.leadLists(params));
    },
  );

  server.registerTool(
    "sn_save_lead",
    {
      title: "Save a lead to a Sales Navigator lead list",
      description:
        "Save a LinkedIn member into a Sales Navigator lead list. list_id is the target lead-list id, from " +
        "sn_list_lists(type: lead_lists). This saves a member into a LEAD list, use sn_save_account instead to " +
        "save a company into an account list. Requires a Sales Navigator seat.",
      inputSchema: {
        account_id: z.string().describe("The connected account id whose seat owns the list."),
        list_id: z.string().describe("The target lead-list id, from sn_list_lists."),
        user_id: z.string().describe("The LinkedIn member id to save."),
      },
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async ({ account_id, list_id, user_id }) =>
      runTool(() => curviate.account(account_id).salesNavigator.saveLead({ list_id, user_id })),
  );

  server.registerTool(
    "sn_save_account",
    {
      title: "Save a company to a Sales Navigator account list",
      description:
        "Save a LinkedIn company into a Sales Navigator account list. list_id is the target account-list id, " +
        "from sn_list_lists(type: account_lists). This saves a COMPANY into an account list, use sn_save_lead " +
        "instead to save a member into a lead list. Requires a Sales Navigator seat.",
      inputSchema: {
        account_id: z.string().describe("The connected account id whose seat owns the list."),
        list_id: z.string().describe("The target account-list id, from sn_list_lists."),
        company_id: z.string().describe("The numeric LinkedIn company id to save, from get_company or sn_search_companies."),
      },
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async ({ account_id, list_id, company_id }) =>
      runTool(() => curviate.account(account_id).salesNavigator.saveAccount({ list_id, company_id })),
  );
}
