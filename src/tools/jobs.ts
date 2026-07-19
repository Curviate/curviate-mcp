/**
 * Job-posting tools, backed by the SDK's `jobs` resource. Covers the
 * connected account's own classic LinkedIn job postings: listing, reading,
 * drafting, editing, publishing, closing, and reading applicants. For market
 * or candidate research across all of LinkedIn, use search_jobs instead.
 */
import type { Curviate } from "@curviate/sdk";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CurviateError } from "@curviate/sdk";
import { z } from "zod";
import { runTool } from "../tool-result.js";

const JOB_STATES = ["DRAFT", "OPEN", "CLOSED", "REVIEW", "SUSPENDED"] as const;
const WORKPLACE_TYPES = ["ON_SITE", "HYBRID", "REMOTE"] as const;
const EMPLOYMENT_STATUSES = [
  "FULL_TIME",
  "PART_TIME",
  "CONTRACT",
  "TEMPORARY",
  "OTHER",
  "VOLUNTEER",
  "INTERNSHIP",
] as const;
const APPLICANT_RATINGS = ["UNRATED", "NOT_A_FIT", "MAYBE", "GOOD_FIT"] as const;

const nameOrIdField = z
  .object({
    id: z.string().optional().describe("An existing LinkedIn id, when known."),
    name: z.string().optional().describe("A free-text name, when no id is known."),
  })
  .describe("Reference an existing LinkedIn entity by id, or supply a free-text name.");

const applyMethodField = z
  .union([
    z.object({
      method: z.literal("linkedin").describe("Candidates apply through LinkedIn."),
      notification_email: z.string().describe("Email address notified of new applicants."),
    }),
    z.object({
      method: z.literal("external").describe("Candidates apply through an external site."),
      website_url: z.string().describe("External URL candidates apply through."),
    }),
  ])
  .describe("How candidates apply: through LinkedIn (with a notification email) or an external site.");

const budgetField = z.object({
  currency: z.string().describe("ISO-4217 currency code, e.g. EUR."),
  amount: z.number().positive().describe("Budget amount, in the given currency."),
  scope: z.enum(["DAILY", "TOTAL"]).describe("Whether the amount is a daily or a total budget."),
});

const jobIdField = z.string().describe("The job posting's numeric id, from create_job_draft or list_jobs.");

export function registerJobTools(server: McpServer, curviate: Curviate): void {
  server.registerTool(
    "list_jobs",
    {
      title: "List the account's own job postings",
      description:
        "List classic LinkedIn job postings owned by the connected account, filtered by lifecycle state. " +
        "Own postings only, for market or candidate research across all of LinkedIn use search_jobs instead. " +
        "Filtering by state is applied by LinkedIn and is best-effort, re-filter on each returned item's own " +
        "state field for a strict match.",
      inputSchema: {
        account_id: z.string().describe("The connected account id whose job postings to list."),
        state: z.enum(JOB_STATES).describe("Filter by posting lifecycle state. Required."),
        limit: z.number().int().min(1).max(100).optional().describe("Results per page (1-100, default 20)."),
        cursor: z.string().optional().describe("Opaque pagination cursor from a prior response."),
      },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ account_id, ...params }) => runTool(() => curviate.account(account_id).jobs.list(params)),
  );

  server.registerTool(
    "get_job",
    {
      title: "Get a job posting, optionally with its budget",
      description:
        "Fetch one of the account's own classic job postings by id, with title, company, location, " +
        "description, applicant count, and budget when set. Pass include_budget true to also fetch pricing " +
        "and spend details in the same call, priced before committing any money. Own postings only, for " +
        "another company's listing use search_jobs or browse_company instead.",
      inputSchema: {
        account_id: z.string().describe("The connected account id to read as."),
        job_id: jobIdField,
        with_sections: z
          .array(z.string())
          .optional()
          .describe("Additional sections to include, e.g. hiring_team, salary, benefits. Omit for base fields only."),
        include_budget: z
          .boolean()
          .optional()
          .describe("Also fetch the posting's budget and spend details (a second call). Defaults to false."),
      },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ account_id, job_id, with_sections, include_budget }) =>
      runTool(async () => {
        const acc = curviate.account(account_id);
        const posting = await acc.jobs.get(job_id, with_sections !== undefined ? { with_sections } : undefined);
        if (include_budget !== true) return posting;
        const budget = await acc.jobs.getBudget(job_id);
        return { ...posting, budget };
      }),
  );

  server.registerTool(
    "create_job_draft",
    {
      title: "Create a job posting draft",
      description:
        "Create a classic LinkedIn job posting as a DRAFT on the connected account. This never publishes " +
        "and never spends money, the draft is safe to create and leave unpublished. Call transition_job with " +
        "action publish to make it live, and edit_job to change fields on the draft first.",
      inputSchema: {
        account_id: z.string().describe("The connected account id to create the posting on behalf of."),
        job_title: nameOrIdField,
        company: nameOrIdField,
        workplace_type: z.enum(WORKPLACE_TYPES).describe("Workplace arrangement."),
        location: z.string().describe("A LOCATION parameter id from search_people's location filter resolution."),
        employment_status: z.enum(EMPLOYMENT_STATUSES).describe("Employment type."),
        description: z.string().min(200).describe("Full job description (minimum 200 characters)."),
        apply_method: applyMethodField,
        skills: z.array(z.string()).optional().describe("Optional skill parameter ids."),
        screening_questions: z.array(z.unknown()).optional().describe("Optional screening questions attached to the posting."),
        rejection_settings: z.unknown().optional().describe("Optional automatic-rejection configuration."),
      },
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async ({ account_id, ...body }) => runTool(() => curviate.account(account_id).jobs.create(body)),
  );

  server.registerTool(
    "edit_job",
    {
      title: "Edit a job posting",
      description:
        "Apply a partial update to a job posting the connected account owns, only the included fields " +
        "change. This can affect real money: editing a posting that is already published (LISTED) changes " +
        "a live, money-spending listing. Use create_job_draft instead to create a new posting, and " +
        "transition_job to publish or close one.",
      inputSchema: {
        account_id: z.string().describe("The connected account id that owns the posting."),
        job_id: jobIdField,
        job_title: nameOrIdField.optional(),
        company: nameOrIdField.optional(),
        workplace_type: z.enum(WORKPLACE_TYPES).optional().describe("Workplace arrangement."),
        location: z.string().optional().describe("A LOCATION parameter id."),
        employment_status: z.enum(EMPLOYMENT_STATUSES).optional().describe("Employment type."),
        description: z.string().min(200).optional().describe("Full job description (minimum 200 characters)."),
        apply_method: applyMethodField.optional(),
        skills: z.array(z.string()).optional().describe("Optional skill parameter ids."),
        screening_questions: z.array(z.unknown()).optional().describe("Optional screening questions attached to the posting."),
        rejection_settings: z.unknown().optional().describe("Optional automatic-rejection configuration."),
      },
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async ({ account_id, job_id, ...body }) => runTool(() => curviate.account(account_id).jobs.update(job_id, body)),
  );

  server.registerTool(
    "transition_job",
    {
      title: "Publish or close a job posting",
      description:
        "Publish a draft job posting live, or close a live one, chosen by action. Publishing with mode " +
        "PROMOTED or PROMOTED_PLUS permanently spends real money against the connected account's LinkedIn " +
        "payment method, supplying budget on those modes is the explicit opt-in, there is no preview or " +
        "confirmation step. Closing stops further applications and is irreversible for a listed posting. " +
        "Use create_job_draft or edit_job instead to create or change a posting's fields.",
      inputSchema: {
        account_id: z.string().describe("The connected account id that owns the posting."),
        job_id: jobIdField,
        action: z.enum(["publish", "close"]).describe("Whether to publish the draft or close a live posting."),
        mode: z
          .enum(["FREE", "PROMOTED", "PROMOTED_PLUS"])
          .optional()
          .describe(
            "Required when action is publish. FREE requires free-posting eligibility and spends nothing. " +
              "PROMOTED and PROMOTED_PLUS spend real money on the connected account's LinkedIn payment method.",
          ),
        set_hiring_frame: z.boolean().optional().describe("FREE mode only: add the hiring frame to the poster's profile picture. Defaults to true."),
        bypass_email_verification: z
          .boolean()
          .optional()
          .describe("FREE mode only: skip the posting-eligibility email verification step. Defaults to false."),
        budget: budgetField.optional().describe("Required when mode is PROMOTED or PROMOTED_PLUS. Providing it is the explicit opt-in to spend real money."),
      },
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async ({ account_id, job_id, action, mode, set_hiring_frame, bypass_email_verification, budget }) =>
      runTool(async () => {
        const acc = curviate.account(account_id);
        if (action === "close") {
          return acc.jobs.close(job_id);
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
          return acc.jobs.publish(job_id, {
            mode: "FREE",
            ...(set_hiring_frame !== undefined ? { set_hiring_frame } : {}),
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
        return acc.jobs.publish(job_id, { mode, budget });
      }),
  );

  server.registerTool(
    "list_job_applicants",
    {
      title: "List a job posting's applicants, or fetch one applicant",
      description:
        "List applicants to one of the account's own job postings, filterable by rating, keywords, location, " +
        "and skills. Pass applicant_id to fetch one specific applicant's full detail, including contact " +
        "information, instead of the list. This reads applicants, not postings, use list_jobs for the " +
        "postings themselves.",
      inputSchema: {
        account_id: z.string().describe("The connected account id that owns the posting."),
        job_id: jobIdField,
        applicant_id: z
          .string()
          .optional()
          .describe("A specific applicant's id. When supplied, returns that single applicant's full detail instead of a list."),
        ratings: z.array(z.enum(APPLICANT_RATINGS)).optional().describe("Filter by applicant rating. Omit to see the full funnel."),
        keywords: z.string().optional().describe("Free-text keyword filter over applicant profiles."),
        sort_by: z.enum(["APPLIED_DATE", "FIRST_NAME", "LAST_NAME"]).optional().describe("Sort order. Defaults to APPLIED_DATE."),
        location: z.array(z.string()).optional().describe("Opaque location ids to filter applicants by."),
        years_of_experience: z
          .array(z.object({ min: z.number().optional(), max: z.number().optional() }))
          .optional()
          .describe("Years-of-experience ranges to filter applicants by."),
        skills: z.array(z.string()).optional().describe("Opaque skill parameter ids to filter applicants by."),
        limit: z.number().int().min(1).max(100).optional().describe("Results per page (1-100, default 20)."),
        cursor: z.string().optional().describe("Opaque pagination cursor from a prior response."),
      },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ account_id, job_id, applicant_id, ...params }) => {
      const acc = curviate.account(account_id);
      if (applicant_id !== undefined) {
        return runTool(() => acc.jobs.getApplicant(job_id, applicant_id));
      }
      return runTool(() => acc.jobs.listApplicants(job_id, params));
    },
  );
}
