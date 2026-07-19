/**
 * Recruiter tools, backed by the SDK's `recruiter` resource. Requires a
 * Recruiter seat on the connected account; a seat-less account gets a
 * structured TIER_NOT_ACTIVE error, not a silent downgrade. Use the sibling
 * Core or Sales Navigator tool when you do not have a Recruiter seat.
 *
 * Most id-bearing filters take an already-resolved opaque parameter id (a
 * plain string or array of strings). This package does not resolve
 * free-text names to ids.
 */
import type { Curviate } from "@curviate/sdk";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CurviateError } from "@curviate/sdk";
import { z } from "zod";
import { runTool } from "../tool-result.js";

const numberRange = z.object({ min: z.number().int().nonnegative().optional(), max: z.number().int().nonnegative().optional() });

/** Closed bucket-boundary values for the applicants company_size filter (LinkedIn's own vocabulary). */
const companySizeBucket = z.object({
  min: z
    .union([z.literal(1), z.literal(51), z.literal(201), z.literal(501), z.literal(1001), z.literal(5001), z.literal(10001)])
    .optional(),
  max: z
    .union([z.literal(0), z.literal(10), z.literal(200), z.literal(500), z.literal(1000), z.literal(5000), z.literal(10000)])
    .optional(),
});

const recruitingActivityFilter = z.object({
  timespan: z.string().optional(),
  activity_types: z.array(z.string()).optional(),
});

/**
 * The shared candidate-filter set used by both rec_search_candidates and
 * rec_search_talent_pool (which extends it with a required channel_id).
 */
const recruiterSearchFilterFields = {
  keywords: z.string().optional().describe("Free-text keyword filter."),
  spotlights: z.array(z.string()).optional().describe("Candidate spotlight tags to filter by."),
  load_saved_search: z.string().optional().describe("Load filters from a saved-search id."),
  load_custom_filter: z.string().optional().describe("Load filters from a saved custom-filter id."),
  save_search: z.string().optional().describe("Persist this search under this name."),
  save_custom_filter: z.string().optional().describe("Persist this filter set under this name."),
  network_distance: z.array(z.string()).optional().describe("Filter by network distance."),
  location: z.array(z.string()).optional().describe("Opaque location ids."),
  postal_code: z.string().optional().describe("A postal code to search around."),
  postal_code_radius: z.number().optional().describe("Radius around postal_code."),
  job_title: z.array(z.string()).optional().describe("Opaque job-title ids."),
  occupation: z.array(z.string()).optional().describe("Opaque occupation ids."),
  skills: z.array(z.string()).optional().describe("Opaque skill ids."),
  company: z.array(z.string()).optional().describe("Opaque company ids."),
  current_company: z.array(z.string()).optional().describe("Opaque current-company ids."),
  past_company: z.array(z.string()).optional().describe("Opaque company ids for past employers."),
  company_size: z.array(z.string()).optional().describe("Company-size bucket ids."),
  years_of_experience: z.array(numberRange).optional().describe("Years-of-experience ranges."),
  years_in_current_position: z.array(numberRange).optional().describe("Years-in-current-position ranges."),
  years_in_current_company: z.array(numberRange).optional().describe("Years-in-current-company ranges."),
  degree: z.array(z.string()).optional().describe("Opaque degree ids."),
  workplace_type: z.array(z.string()).optional().describe("Workplace type, e.g. ON_SITE, REMOTE, HYBRID."),
  school: z.array(z.string()).optional().describe("Opaque school ids."),
  field_of_study: z.array(z.string()).optional().describe("Opaque field-of-study ids."),
  employment_type: z.array(z.string()).optional().describe("Filter by employment type."),
  graduation_year: z.array(z.number().int()).optional().describe("Graduation years to filter by."),
  industry: z.array(z.string()).optional().describe("Opaque industry ids."),
  seniority: z.array(z.string()).optional().describe("Seniority level filter."),
  spoken_language: z.array(z.string()).optional().describe("Opaque spoken-language ids."),
  profile_language: z.array(z.string()).optional().describe("Filter by profile display language."),
  project: z.string().optional().describe("Opaque project id."),
  job_function: z.array(z.string()).optional().describe("Opaque job-function ids."),
  first_name: z.string().optional().describe("Filter by first name."),
  last_name: z.string().optional().describe("Filter by last name."),
  recently_joined: z.boolean().optional().describe("Filter to members who recently joined LinkedIn."),
  is_military_veteran: z.boolean().optional().describe("Filter to members who self-identify as military veterans."),
  recruiting_activity: z
    .object({ include: recruitingActivityFilter.optional(), exclude: recruitingActivityFilter.optional() })
    .optional()
    .describe("Include/exclude by recent recruiting activity."),
  hide_previously_viewed: z.boolean().optional().describe("Exclude profiles already viewed."),
  group: z.array(z.string()).optional().describe("Opaque LinkedIn group ids."),
  is_past_applicant: z.boolean().optional().describe("Filter to members who previously applied."),
  notes: z.string().optional().describe("Free-text notes filter."),
  tags: z.array(z.string()).optional().describe("Opaque tag ids."),
};

const recruiterChatAttachment = z.object({
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

const RECRUITER_WITH_SECTIONS_BASE = [
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
const RECRUITER_WITH_SECTIONS_VALUES = [
  ...RECRUITER_WITH_SECTIONS_BASE,
  ...RECRUITER_WITH_SECTIONS_BASE.map((s) => `${s}_preview` as const),
] as const;

const withSectionsField = z
  .array(z.enum(RECRUITER_WITH_SECTIONS_VALUES))
  .optional()
  .describe(
    "Which profile sections to fetch. One or more of linkedin_*, linkedin_experience, linkedin_education, " +
      "linkedin_languages, linkedin_skills, linkedin_certifications, linkedin_volunteer_experience, " +
      "linkedin_projects, linkedin_recommendations, linkedin_interests, linkedin_recruiting_activity, and the " +
      "_preview variant of each. Omit for base fields only.",
  );

const RECRUITER_PROJECT_SENIORITY_LEVEL_VALUES = [
  "INTERNSHIP",
  "ENTRY_LEVEL",
  "ASSOCIATE",
  "MID_SENIOR_LEVEL",
  "DIRECTOR",
  "EXECUTIVE",
  "NOT_APPLICABLE",
] as const;

const nameOrId = z
  .object({ id: z.string().optional().describe("An existing LinkedIn id, when known."), name: z.string().optional().describe("A free-text name, when no id is known.") })
  .describe("Reference an existing LinkedIn entity by id, or supply a free-text name.");

const applyMethodField = z
  .union([
    z.object({
      method: z.literal("linkedin").describe("Candidates apply through LinkedIn."),
      notification_email: z.string().describe("Email address notified of new applicants."),
      resume_required: z.boolean().optional(),
    }),
    z.object({
      method: z.literal("external").describe("Candidates apply through an external site."),
      website_url: z.string().describe("External URL candidates apply through."),
    }),
  ])
  .describe("How candidates apply: through LinkedIn (with a notification email) or an external site.");

const salaryField = z.object({
  currency: z.string().describe("ISO-4217 currency code."),
  pay_frequency: z.enum(["YEARLY", "MONTHLY", "HOURLY"]),
  min: z.number().nonnegative(),
  max: z.number().nonnegative(),
});

const screeningQuestionField = z.object({
  question: z.string().describe("The screening question text."),
  answer_type: z.string().describe("The answer-type discriminator, e.g. a yes/no or free-text question."),
  qualification_required: z.boolean().optional(),
});

const rejectionSettingsField = z.object({
  send_rejection_notification: z.boolean(),
  rejection_template: z.string().optional(),
  reject_unqualified_applicants: z.boolean().optional(),
  reject_out_of_country_applicants: z.boolean().optional(),
});

/** Shared create/edit job-posting fields (create requires them; edit makes them all optional). */
const jobPostingFields = {
  job_title: z.object({ id: z.string(), name: z.string() }).describe("The resolved job-title id and its display name."),
  company: z.union([z.object({ id: z.string() }), z.object({ name: z.string() })]).describe("Target company: a resolved id, or a free-text name."),
  workplace_type: z.enum(["ON_SITE", "HYBRID", "REMOTE"]).describe("Workplace arrangement."),
  location: z.string().describe("A resolved location parameter id."),
  seniority_level: z.enum(RECRUITER_PROJECT_SENIORITY_LEVEL_VALUES).describe("Target seniority level."),
  employment_status: z
    .enum(["FULL_TIME", "PART_TIME", "CONTRACT", "TEMPORARY", "OTHER", "VOLUNTEER", "INTERNSHIP"])
    .describe("Employment type."),
  description: z.string().min(200).describe("Full job description (minimum 200 characters)."),
  industry: z.array(z.string()).min(1).max(3).describe("1-3 resolved industry ids."),
  job_function: z.array(z.string()).min(1).max(3).describe("1-3 resolved job-function ids."),
  apply_method: applyMethodField,
  skills: z.array(z.string()).max(10).optional().describe("Up to 10 resolved skill ids."),
  include_poster_info: z.boolean().optional().describe("Whether to show the posting recruiter's info. Defaults to true."),
  tracking_pixel_url: z.string().optional(),
  company_job_id: z.string().optional().describe("Your own external job-requisition id, for reference."),
  screening_questions: z.array(screeningQuestionField).optional(),
  salary: salaryField.optional(),
  additional_compensation: salaryField.optional(),
  rejection_settings: rejectionSettingsField.optional(),
};

const budgetField = z.object({
  currency: z.string().describe("ISO-4217 currency code, e.g. EUR."),
  amount: z.number().positive().describe("Budget amount, in the given currency."),
  scope: z.enum(["DAILY", "TOTAL"]).describe("Whether the amount is a daily or a total budget."),
});

const pagination100 = {
  limit: z.number().int().min(1).max(100).optional().describe("Results per page (1-100, default 25)."),
  cursor: z.string().optional().describe("Opaque pagination cursor from a prior response."),
};

export function registerRecruiterTools(server: McpServer, curviate: Curviate): void {
  server.registerTool(
    "rec_search_candidates",
    {
      title: "Search candidates on the Recruiter surface",
      description:
        "Search LinkedIn members using Recruiter's filter set: location, job title, skills, company, school, " +
        "industry, and more. Most id-bearing filters take a plain array of already-resolved opaque ids. " +
        "Requires a Recruiter seat, use search_people or sn_search_people instead if you do not have one.",
      inputSchema: {
        account_id: z.string().describe("The connected account id to search as."),
        ...recruiterSearchFilterFields,
        ...pagination100,
      },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ account_id, limit, cursor, ...body }) =>
      runTool(() =>
        curviate.account(account_id).recruiter.searchPeople(body, {
          ...(limit !== undefined ? { limit } : {}),
          ...(cursor !== undefined ? { cursor } : {}),
        }),
      ),
  );

  server.registerTool(
    "rec_search_talent_pool",
    {
      title: "Search a Recruiter project's talent pool",
      description:
        "Search a Recruiter project's talent pool. project_id and channel_id are required, read channel_id off " +
        "the project's own talent_pool.channels[] via rec_list_projects. Shares the same filter set as " +
        "rec_search_candidates. Requires a Recruiter seat.",
      inputSchema: {
        account_id: z.string().describe("The connected account id to search as."),
        project_id: z.string().describe("The Recruiter project whose talent pool to search, from rec_list_projects."),
        channel_id: z.string().describe("The project's RECRUITER_SEARCH talent-pool channel id, from rec_list_projects."),
        ...recruiterSearchFilterFields,
        ...pagination100,
      },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ account_id, project_id, channel_id, limit, cursor, ...body }) =>
      runTool(() =>
        curviate.account(account_id).recruiter.searchTalentPool(project_id, { ...body, channel_id }, {
          ...(limit !== undefined ? { limit } : {}),
          ...(cursor !== undefined ? { cursor } : {}),
        }),
      ),
  );

  server.registerTool(
    "rec_search_from_url",
    {
      title: "Search Recruiter from a pasted URL",
      description:
        "Run a pasted Recruiter search, talent-pool, or applicant URL directly instead of building structured " +
        "filters yourself. url is the only accepted field. The response shape (a people search, an applicant " +
        "list, or a pipeline-candidate list) is determined by the kind of URL pasted. Requires a Recruiter seat.",
      inputSchema: {
        account_id: z.string().describe("The connected account id to search as."),
        url: z.string().describe("A pasted Recruiter search, talent-pool, or applicant URL."),
        limit: z.number().int().min(1).max(5000).optional().describe("Results per page (1-5000, default 25; the effective cap depends on the URL kind)."),
        cursor: z.string().optional().describe("Opaque pagination cursor from a prior response."),
      },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ account_id, url, limit, cursor }) =>
      runTool(() =>
        curviate.account(account_id).recruiter.searchFromUrl({
          url,
          ...(limit !== undefined ? { limit } : {}),
          ...(cursor !== undefined ? { cursor } : {}),
        }),
      ),
  );

  server.registerTool(
    "rec_get_profile",
    {
      title: "Get a profile with Recruiter enrichment",
      description:
        "Fetch a LinkedIn profile with Recruiter enrichment (recruiting_profile: notes, tags, events), " +
        "optionally selecting sections with with_sections. Chains into rec_start_chat or rec_save_candidate " +
        "with the returned id. Requires a Recruiter seat, use get_profile or sn_get_profile instead if you do " +
        "not have one.",
      inputSchema: {
        account_id: z.string().describe("The connected account id to look up as."),
        user_id: z.string().describe("'me', a public identifier, a profile URL, or a member id."),
        with_sections: withSectionsField,
      },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ account_id, user_id, with_sections }) =>
      runTool(() =>
        curviate.account(account_id).recruiter.getProfile(user_id, with_sections !== undefined ? { with_sections } : undefined),
      ),
  );

  server.registerTool(
    "rec_start_chat",
    {
      title: "Start a chat (Recruiter)",
      description:
        "Start a new Recruiter InMail-style chat with one or more members and send the opening message in the " +
        "same call. subject and signature are both required, reflecting Recruiter's InMail-based messaging " +
        "(unlike Core's start_chat, where subject is optional and there is no signature). A scheduled " +
        "follow-up message is not supported through this tool. Requires a Recruiter seat.",
      inputSchema: {
        account_id: z.string().describe("The connected account id to send from."),
        attendees_ids: z.array(z.string()).min(1).describe("Recruiter member ids for the chat recipients."),
        text: z.string().min(1).max(8000).describe("Opening message text (1-8000 chars)."),
        subject: z.string().min(1).max(200).describe("Subject line, required for Recruiter InMail-based messaging."),
        signature: z.string().min(1).describe("Sender signature, required for Recruiter."),
        visibility: z.enum(["PUBLIC", "PRIVATE", "PROJECT"]).optional().describe("Visibility of the Recruiter chat."),
        intent: z.enum(["HIRE_FOR_CLIENT", "HIRE_FOR_OWN_COMPANY"]).optional().describe("Whether this outreach is for a client or the operator's own company."),
        send_as: z.enum(["INMAIL", "EMAIL"]).optional().describe("Send the opening message as an InMail or as email."),
        channel_type: z.string().optional().describe("Sourcing channel for tracking purposes, e.g. CAREER_SITE, REFERRAL."),
        attachments: z.array(recruiterChatAttachment).optional().describe("Optional file, voice, or video attachments."),
      },
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async ({ account_id, ...body }) => runTool(() => curviate.account(account_id).recruiter.startChat(body)),
  );

  server.registerTool(
    "rec_list_projects",
    {
      title: "List Recruiter projects, or fetch one",
      description:
        "List Recruiter projects visible to the account, filterable by status and keywords. Pass project_id to " +
        "fetch one specific project's full detail (owner, metadata, talent_pool, pipeline) instead of the list. " +
        "Requires a Recruiter seat.",
      inputSchema: {
        account_id: z.string().describe("The connected account id whose projects to read."),
        project_id: z
          .string()
          .optional()
          .describe("A specific project's id. When supplied, returns that single project's full detail instead of a list."),
        status: z.array(z.enum(["ACTIVE", "CLOSED", "DRAFT", "REVIEW"])).optional().describe("Filter by project status."),
        sort_by: z
          .enum(["LAST_USED_BY_ME", "MOST_USED_BY_ME", "LAST_VIEWED_BY_ME", "NEWEST_TO_OLDEST", "OLDEST_TO_NEWEST", "ALPHABETICAL", "REVERSE_ALPHABETICAL"])
          .optional()
          .describe("Sort order. Defaults to LAST_USED_BY_ME."),
        keywords: z.string().optional().describe("Filter by project name."),
        limit: z.number().int().min(1).max(100).optional().describe("Results per page (1-100, default 10)."),
        cursor: z.string().optional().describe("Opaque pagination cursor from a prior response."),
      },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ account_id, project_id, ...params }) => {
      const acc = curviate.account(account_id);
      if (project_id !== undefined) {
        return runTool(() => acc.recruiter.getProject(project_id));
      }
      return runTool(() => acc.recruiter.listProjects(params));
    },
  );

  server.registerTool(
    "rec_edit_project",
    {
      title: "Edit a Recruiter project",
      description:
        "Edit a Recruiter project's config: name, visibility, description, target company, job title, " +
        "location, and seniority level. All fields optional, any omitted field is left unchanged. Returns a " +
        "thin acknowledgement only. Requires a Recruiter seat.",
      inputSchema: {
        account_id: z.string().describe("The connected account id that owns the project."),
        project_id: z.string().describe("The project id, from rec_list_projects."),
        name: z.string().optional().describe("New project name."),
        visibility: z.enum(["PRIVATE", "PUBLIC"]).optional().describe("New project visibility."),
        description: z.string().optional().describe("New project description."),
        company: nameOrId.optional().describe("Target company."),
        job_title: z.object({ id: z.string(), name: z.string() }).optional().describe("Target job title (resolved id + display name)."),
        location: z.string().optional().describe("A location parameter id."),
        seniority_level: z.enum(RECRUITER_PROJECT_SENIORITY_LEVEL_VALUES).optional().describe("Target seniority level."),
      },
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async ({ account_id, project_id, ...body }) =>
      runTool(() => curviate.account(account_id).recruiter.updateProject(project_id, body)),
  );

  server.registerTool(
    "rec_list_pipeline",
    {
      title: "List candidates in a Recruiter project's pipeline",
      description:
        "List candidates in a Recruiter project's pipeline, filterable by keywords, stage, spotlights, " +
        "recruiting activity, skills, and experience. Use rec_save_candidate to add a candidate to the " +
        "pipeline instead of listing it. Requires a Recruiter seat.",
      inputSchema: {
        account_id: z.string().describe("The connected account id that owns the project."),
        project_id: z.string().describe("The project id, from rec_list_projects."),
        keywords: z.string().optional().describe("Free-text keyword filter."),
        stage_id: z.string().optional().describe("Filter to a single pipeline stage id."),
        sort_by: z.enum(["LAST_MODIFIED", "ALPHABETICAL"]).optional().describe("Sort order."),
        spotlights: z.array(z.enum(["OPEN_TO_WORK", "ACTIVE_TALENT", "MISSED_CANDIDATES"])).optional().describe("Filter by candidate spotlight."),
        recruiting_activity: z
          .object({ include: recruitingActivityFilter.optional(), exclude: recruitingActivityFilter.optional() })
          .optional()
          .describe("Include/exclude by recent recruiting activity."),
        added_by: z.array(z.string()).optional().describe("Filter by the recruiter(s) who added the candidate."),
        skills: z.array(z.string()).optional().describe("Opaque skill ids."),
        years_of_experience: z.array(numberRange).optional().describe("Years-of-experience ranges."),
        job_title: z.array(z.string()).optional().describe("Opaque job-title ids."),
        current_company: z.array(z.string()).optional().describe("Opaque company ids."),
        current_location: z.array(z.string()).optional().describe("Opaque location ids."),
        limit: z.number().int().min(1).max(5000).optional().describe("Results per page (1-5000, default 25)."),
        cursor: z.string().optional().describe("Opaque pagination cursor from a prior response."),
      },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ account_id, project_id, limit, cursor, ...body }) =>
      runTool(() =>
        curviate.account(account_id).recruiter.listPipeline(project_id, body, {
          ...(limit !== undefined ? { limit } : {}),
          ...(cursor !== undefined ? { cursor } : {}),
        }),
      ),
  );

  server.registerTool(
    "rec_save_candidate",
    {
      title: "Save a candidate to a Recruiter project's pipeline",
      description:
        "Save a candidate or user profile to a Recruiter project's pipeline at the given stage_id. " +
        "candidate_id is the id from a prior rec_search_candidates, rec_search_talent_pool, or " +
        "rec_list_applicants result. Use rec_list_pipeline to read the pipeline back afterward. Requires a " +
        "Recruiter seat.",
      inputSchema: {
        account_id: z.string().describe("The connected account id that owns the project."),
        project_id: z.string().describe("The project id, from rec_list_projects."),
        stage_id: z.string().describe("The pipeline stage id to save the candidate into."),
        candidate_id: z.string().describe("The candidate id or user-profile id to save to the pipeline."),
      },
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async ({ account_id, project_id, ...body }) =>
      runTool(() => curviate.account(account_id).recruiter.saveCandidate(project_id, body)),
  );

  server.registerTool(
    "rec_list_applicants",
    {
      title: "List a project's talent-pool applicants, or fetch one",
      description:
        "List applicants in a Recruiter project's talent pool. channel_id (the JOB_POSTING talent-pool " +
        "channel, from rec_list_projects's talent_pool.channels[]) is required when listing. Pass applicant_id " +
        "to fetch one specific applicant's full detail (including contact information) instead of the list. " +
        "A resume download is not available through this tool. Requires a Recruiter seat.",
      inputSchema: {
        account_id: z.string().describe("The connected account id that owns the project."),
        project_id: z.string().describe("The project id, from rec_list_projects."),
        applicant_id: z
          .string()
          .optional()
          .describe("A specific applicant's id. When supplied, returns that single applicant's full detail instead of the list."),
        channel_id: z.string().optional().describe("The JOB_POSTING talent-pool channel id. Required unless applicant_id is supplied."),
        keywords: z.string().optional().describe("Free-text keyword filter."),
        sort_by: z.enum(["SCREENING_REQUIREMENTS", "RELEVANCE", "NEWEST_FIRST", "ALPHABETICAL"]).optional().describe("Sort order."),
        spotlights: z.array(z.literal("ACTIVE_TALENT")).optional().describe("Filter by candidate spotlight."),
        location: z.array(z.string()).optional().describe("Opaque location ids."),
        company: includeExcludeShape().optional().describe("Opaque company ids to include/exclude."),
        skills: z.array(z.string()).optional().describe("Opaque skill ids."),
        school: includeExcludeShape().optional().describe("Opaque school ids to include/exclude."),
        industry: z.array(z.string()).optional().describe("Opaque industry ids."),
        job_title: z.array(z.string()).optional().describe("Opaque job-title ids."),
        spoken_language: z
          .array(z.object({ id: z.string(), priority: z.enum(["CAN_HAVE", "MUST_HAVE", "DOESNT_HAVE"]).optional() }))
          .optional()
          .describe("Spoken-language filters."),
        spoken_language_proficiency: z
          .enum(["ELEMENTARY", "LIMITED_WORKING", "PROFESSIONAL_WORKING", "FULL_PROFESSIONAL", "NATIVE_OR_BILINGUAL"])
          .optional()
          .describe("Required proficiency level for the spoken languages."),
        network_distance: z
          .array(z.union([z.literal(1), z.literal(2), z.literal(3), z.literal("GROUP")]))
          .optional()
          .describe("Connection distance: 1 (1st), 2 (2nd), 3 (3rd+), or GROUP (group members)."),
        years_of_experience: z.object({ min: z.number().int().min(0).max(30), max: z.number().int().min(0).max(30) }).optional().describe("Years-of-experience range (0-30)."),
        years_in_current_position: z.object({ min: z.number().int().nonnegative(), max: z.number().int().nonnegative() }).optional().describe("Years-in-current-position range."),
        years_in_current_company: z.object({ min: z.number().int().nonnegative(), max: z.number().int().nonnegative() }).optional().describe("Years-in-current-company range."),
        degree: includeExcludeShape().optional().describe("Opaque degree ids to include/exclude."),
        field_of_study: includeExcludeShape().optional().describe("Opaque field-of-study ids to include/exclude."),
        seniority: z
          .array(z.enum(["UNPAID", "TRAINING", "ENTRY", "SENIOR", "MANAGER", "DIRECTOR", "VP", "CXO", "PARTNER", "OWNER"]))
          .optional()
          .describe("Filter by seniority level."),
        job_function: z.array(z.string()).optional().describe("Opaque job-function ids."),
        current_company: includeExcludeShape().optional().describe("Opaque company ids to include/exclude."),
        company_size: z.array(companySizeBucket).optional().describe("Company-size bucket ranges: min in 1/51/201/501/1001/5001/10001, max in 0/10/200/500/1000/5000/10000."),
        tags: includeExcludeShape().optional().describe("Opaque tag ids to include/exclude."),
        limit: z.number().int().min(1).max(100).optional().describe("Results per page (1-100, default 25)."),
        cursor: z.string().optional().describe("Opaque pagination cursor from a prior response."),
      },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ account_id, project_id, applicant_id, channel_id, limit, cursor, ...body }) => {
      const acc = curviate.account(account_id);
      return runTool(async () => {
        if (applicant_id !== undefined) {
          return acc.recruiter.getApplicant(project_id, applicant_id);
        }
        if (channel_id === undefined) {
          throw new CurviateError({
            code: "INVALID_REQUEST",
            message: "channel_id is required when applicant_id is not supplied.",
            userFixable: true,
            retryLikelyToSucceed: false,
          });
        }
        return acc.recruiter.listApplicants(project_id, { ...body, channel_id }, {
          ...(limit !== undefined ? { limit } : {}),
          ...(cursor !== undefined ? { cursor } : {}),
        });
      });
    },
  );

  server.registerTool(
    "rec_list_jobs",
    {
      title: "List Recruiter job postings, or fetch one",
      description:
        "List Recruiter job postings, filterable by state, location, job_poster, contract, and workplace_type. " +
        "Pass project_id alone to fetch the single job posting attached to that project, or job_id to fetch a " +
        "specific posting by id (add project_id and include_budget true to also fetch its budget). Use " +
        "rec_create_job_draft to create a new posting instead of listing one.",
      inputSchema: {
        account_id: z.string().describe("The connected account id that owns the postings."),
        project_id: z.string().optional().describe("A project's id. With no job_id, returns the single job posting attached to that project."),
        job_id: z.string().optional().describe("A specific job posting's id. When supplied, returns that single posting instead of the list."),
        include_budget: z
          .boolean()
          .optional()
          .describe("job_id and project_id both required: also fetch the posting's budget and pricing in the same call. Defaults to false."),
        state: z.array(z.enum(["DRAFT", "OPEN", "CLOSED", "REVIEW", "SUSPENDED"])).optional().describe("Filter by posting lifecycle state. Defaults to OPEN."),
        sort_by: z.enum(["LAST_ACCESS_TIME", "CHRONOLOGICAL", "REVERSE_CHRONOLOGICAL"]).optional().describe("Sort order."),
        location: z.array(z.string()).optional().describe("Opaque location ids."),
        job_poster: z.array(z.string()).optional().describe("Opaque job-poster (seat) ids."),
        contract: z.array(z.string()).optional().describe("Opaque contract ids."),
        workplace_type: z.array(z.enum(["ON_SITE", "REMOTE", "HYBRID"])).optional().describe("Filter by workplace type."),
        limit: z.number().int().min(1).max(100).optional().describe("Results per page (1-100, default 10)."),
        cursor: z.string().optional().describe("Opaque pagination cursor from a prior response."),
      },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ account_id, project_id, job_id, include_budget, ...params }) => {
      const acc = curviate.account(account_id);

      if (job_id !== undefined) {
        return runTool(async () => {
          const posting = await acc.recruiter.getJob(job_id);
          if (include_budget !== true) return posting;
          if (project_id === undefined) {
            throw new CurviateError({
              code: "INVALID_REQUEST",
              message: "project_id is required alongside job_id when include_budget is true.",
              userFixable: true,
              retryLikelyToSucceed: false,
            });
          }
          const budget = await acc.recruiter.getProjectJobBudget(project_id, job_id);
          return { ...posting, budget };
        });
      }
      if (project_id !== undefined) {
        return runTool(() => acc.recruiter.getProjectJob(project_id));
      }
      return runTool(() => acc.recruiter.listJobs(params));
    },
  );

  server.registerTool(
    "rec_create_job_draft",
    {
      title: "Create a Recruiter job posting draft",
      description:
        "Create a Recruiter job-posting DRAFT, either in a brand-new project (pass project_name) or attached " +
        "to an existing project (pass project_id). Exactly one of project_id or project_name is required, " +
        "never both. This never publishes or spends money by itself, call rec_transition_job with action " +
        "publish to make it live.",
      inputSchema: {
        account_id: z.string().describe("The connected account id to create the posting on behalf of."),
        project_id: z.string().optional().describe("An existing project's id to attach the draft to. Mutually exclusive with project_name."),
        project_name: z.string().optional().describe("The name of a brand-new project to create alongside the draft. Mutually exclusive with project_id."),
        ...jobPostingFields,
      },
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async ({ account_id, project_id, project_name, ...body }) => {
      const acc = curviate.account(account_id);
      return runTool(async () => {
        if (project_id !== undefined && project_name !== undefined) {
          throw new CurviateError({
            code: "INVALID_REQUEST",
            message: "Pass only one of project_id or project_name, never both.",
            userFixable: true,
            retryLikelyToSucceed: false,
          });
        }
        if (project_id !== undefined) {
          return acc.recruiter.createProjectJob(project_id, body);
        }
        if (project_name === undefined) {
          throw new CurviateError({
            code: "INVALID_REQUEST",
            message: "project_name is required when project_id is omitted.",
            userFixable: true,
            retryLikelyToSucceed: false,
          });
        }
        return acc.recruiter.createJob({ ...body, project_name });
      });
    },
  );

  server.registerTool(
    "rec_edit_job",
    {
      title: "Edit a Recruiter job posting",
      description:
        "Partially update a Recruiter job posting, any omitted field is left unchanged. Editing a posting " +
        "that is already published (LISTED, REVIEW, or SUSPENDED) mutates a live, money-spending listing, not " +
        "just a draft. Use rec_create_job_draft instead to create a new posting, and rec_transition_job " +
        "instead to publish or close one.",
      inputSchema: {
        account_id: z.string().describe("The connected account id that owns the posting."),
        project_id: z.string().describe("The project id, from rec_list_projects."),
        job_id: z.string().describe("The job posting id, from rec_create_job_draft's response or rec_list_jobs."),
        job_title: jobPostingFields.job_title.optional(),
        company: jobPostingFields.company.optional(),
        workplace_type: jobPostingFields.workplace_type.optional(),
        location: jobPostingFields.location.optional(),
        seniority_level: jobPostingFields.seniority_level.optional(),
        employment_status: jobPostingFields.employment_status.optional(),
        description: z.string().min(200).optional().describe("New job description (minimum 200 characters)."),
        industry: jobPostingFields.industry.optional(),
        job_function: jobPostingFields.job_function.optional(),
        apply_method: jobPostingFields.apply_method.optional(),
        skills: jobPostingFields.skills,
        include_poster_info: jobPostingFields.include_poster_info,
        tracking_pixel_url: jobPostingFields.tracking_pixel_url,
        company_job_id: jobPostingFields.company_job_id,
        screening_questions: jobPostingFields.screening_questions,
        salary: jobPostingFields.salary,
        additional_compensation: jobPostingFields.additional_compensation,
        rejection_settings: jobPostingFields.rejection_settings,
      },
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async ({ account_id, project_id, job_id, ...body }) =>
      runTool(() => curviate.account(account_id).recruiter.updateProjectJob(project_id, job_id, body)),
  );

  server.registerTool(
    "rec_transition_job",
    {
      title: "Publish or close a Recruiter job posting",
      description:
        "Publish a draft Recruiter job posting live, or close a live one, chosen by action. Publishing with " +
        "mode PROMOTED or PROMOTED_PLUS permanently spends real money against the connected account's " +
        "LinkedIn payment method, providing budget is the explicit opt-in to spend, there is no preview or " +
        "confirmation step. Closing stops further applications and is irreversible for a live posting, there " +
        "is no re-open operation.",
      inputSchema: {
        account_id: z.string().describe("The connected account id that owns the posting."),
        project_id: z.string().describe("The project id, from rec_list_projects."),
        job_id: z.string().describe("The job posting id, from rec_create_job_draft's response or rec_list_jobs."),
        action: z.enum(["publish", "close"]).describe("Whether to publish the draft or close a live posting."),
        mode: z
          .enum(["FREE", "PROMOTED", "PROMOTED_PLUS"])
          .optional()
          .describe(
            "Required when action is publish. FREE requires free-posting eligibility and spends nothing. " +
              "PROMOTED and PROMOTED_PLUS spend real money on the connected account's LinkedIn payment method.",
          ),
        budget: budgetField.optional().describe("Required when mode is PROMOTED or PROMOTED_PLUS. Providing it is the explicit opt-in to spend real money."),
        bypass_email_verification: z.boolean().optional().describe("action publish only: skip the posting-eligibility email verification step."),
      },
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async ({ account_id, project_id, job_id, action, mode, budget, bypass_email_verification }) => {
      const acc = curviate.account(account_id);
      return runTool(async () => {
        if (action === "close") {
          return acc.recruiter.closeJob(project_id, job_id);
        }
        if (mode === undefined) {
          throw new CurviateError({
            code: "INVALID_REQUEST",
            message: "mode is required when action is publish. Pass one of FREE, PROMOTED, or PROMOTED_PLUS.",
            userFixable: true,
            retryLikelyToSucceed: false,
          });
        }
        if (mode === "FREE") {
          return acc.recruiter.publishJob(project_id, job_id, {
            mode: "FREE",
            ...(bypass_email_verification !== undefined ? { bypass_email_verification } : {}),
          });
        }
        if (budget === undefined) {
          throw new CurviateError({
            code: "INVALID_REQUEST",
            message: "budget is required when mode is PROMOTED or PROMOTED_PLUS.",
            userFixable: true,
            retryLikelyToSucceed: false,
          });
        }
        return acc.recruiter.publishJob(project_id, job_id, {
          mode,
          budget,
          ...(bypass_email_verification !== undefined ? { bypass_email_verification } : {}),
        });
      });
    },
  );
}

function includeExcludeShape() {
  return z.object({ include: z.array(z.string()).optional(), exclude: z.array(z.string()).optional() });
}
