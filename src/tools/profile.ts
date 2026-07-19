/**
 * Profile-group tools: the caller's own profile management, activity,
 * network, and insight reads. `get_profile` itself (a third-party-capable
 * read) lives in users.ts; this file covers the remaining profile-group
 * tools, backed by the SDK's `users` and `profile` resources.
 */
import type { Curviate } from "@curviate/sdk";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CurviateError } from "@curviate/sdk";
import { z } from "zod";
import { runTool } from "../tool-result.js";

function assertMeOnly(userId: string, toolName: string, leg: string): void {
  if (userId.trim().toLowerCase() !== "me") {
    throw new CurviateError({
      code: "INVALID_REQUEST",
      message: `${toolName}(type:"${leg}") only supports the caller's own account. Pass user_id "me" or omit it.`,
      userFixable: true,
      retryLikelyToSucceed: false,
    });
  }
}

function userIdOrMe(userId: string | undefined): string {
  return userId && userId.trim().length > 0 ? userId.trim() : "me";
}

const attachmentField = z.object({
  content: z.string().describe("Base64-encoded file bytes."),
  content_type: z.string().describe("Attachment MIME type (e.g. image/png, image/jpeg)."),
  filename: z.string().describe("File name for the attachment."),
});

export function registerProfileTools(server: McpServer, curviate: Curviate): void {
  server.registerTool(
    "update_my_profile",
    {
      title: "Update your own profile",
      description:
        "Update the caller's own LinkedIn profile fields: first_name, last_name, bio, headline, skills " +
        "(add-only, it never removes or reorders existing skills), profile photo, and cover photo. This " +
        "always targets the caller's own profile, passing a user_id other than \"me\" is rejected rather " +
        "than silently acting on the wrong target. Profile changes can take a short while to appear on " +
        "LinkedIn, and rapid successive edits may not all be applied.",
      inputSchema: {
        account_id: z.string().describe("The connected account id to update."),
        user_id: z
          .string()
          .optional()
          .describe('Must be "me" (the default), this tool only updates the caller\'s own profile.'),
        first_name: z.string().optional().describe("New first name."),
        last_name: z.string().optional().describe("New last name."),
        bio: z.string().optional().describe("New text for the profile's About section."),
        headline: z.string().optional().describe("New profile headline, the short line shown under the name."),
        skills: z
          .array(z.object({ name: z.string().describe("The skill name to add."), id: z.string().optional().describe("Optional skill parameter id.") }))
          .optional()
          .describe("Skills to add to the profile. Add-only, never removes or reorders existing skills."),
        picture: attachmentField.optional().describe("New profile photo."),
        background_picture: attachmentField.optional().describe("New cover or banner photo."),
      },
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async ({ account_id, user_id, ...body }) =>
      runTool(() => {
        if (user_id !== undefined && user_id.trim().toLowerCase() !== "me") {
          throw new CurviateError({
            code: "INVALID_REQUEST",
            message: 'user_id must be "me": update_my_profile only updates the caller\'s own profile.',
            userFixable: true,
            retryLikelyToSucceed: false,
          });
        }
        return curviate.account(account_id).users.update("me", body);
      }),
  );

  server.registerTool(
    "list_profile_activity",
    {
      title: "List a person's posts, comments, reactions, or saved posts",
      description:
        "List one person's activity: authored posts, authored comments, given reactions, or (caller only) " +
        "saved posts, selected with type. user_id defaults to the caller's own account, and must be \"me\" " +
        "(or omitted) for type saved_posts, since it is a private bookmark list with no other-member view.",
      inputSchema: {
        account_id: z.string().describe("The connected account id to read as."),
        type: z
          .enum(["posts", "comments", "reactions", "saved_posts"])
          .describe(
            "Which activity to list: posts (authored posts), comments (authored comments), reactions (given reactions), or saved_posts (caller's own bookmark list, self only).",
          ),
        user_id: z
          .string()
          .optional()
          .describe('The person whose activity to list: "me" (default) or another member\'s id, handle, or URL. Must be "me" for type saved_posts.'),
        limit: z.number().int().min(1).max(100).optional().describe("Results per page (1-100, default 20)."),
        cursor: z.string().optional().describe("Opaque pagination cursor from a prior response."),
      },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ account_id, type, user_id, limit, cursor }) => {
      const acc = curviate.account(account_id);
      const targetUserId = userIdOrMe(user_id);
      const params = { ...(limit !== undefined ? { limit } : {}), ...(cursor !== undefined ? { cursor } : {}) };

      switch (type) {
        case "saved_posts":
          return runTool(() => {
            assertMeOnly(targetUserId, "list_profile_activity", "saved_posts");
            return acc.posts.listSaved(params);
          });
        case "posts":
          return runTool(() => acc.posts.listUserPosts(targetUserId, params));
        case "comments":
          return runTool(() => acc.comments.listUserComments(targetUserId, params));
        case "reactions":
          return runTool(() => acc.posts.listUserReactions(targetUserId, params));
      }
    },
  );

  server.registerTool(
    "list_network",
    {
      title: "List a person's connections, followers, or following",
      description:
        "List one person's network: 1st-degree connections (caller only), who follows them (any user_id), " +
        "or who they follow (caller only), selected with type. Use search_people to find new people instead " +
        "of listing an existing network.",
      inputSchema: {
        account_id: z.string().describe("The connected account id to read as."),
        type: z
          .enum(["connections", "followers", "following"])
          .describe(
            "Which network view: connections (1st-degree, self only), followers (who follows this person, any user_id), or following (who this person follows, self only).",
          ),
        user_id: z
          .string()
          .optional()
          .describe('The person to query (type followers only): "me" (default) or another member\'s id, handle, or URL. Must be "me" for type connections/following.'),
        filter: z.string().optional().describe("Filter results by member name (type connections only)."),
        limit: z.number().int().min(1).max(1000).optional().describe("Results per page, default varies by leg."),
        cursor: z.string().optional().describe("Opaque pagination cursor from a prior response."),
      },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ account_id, type, user_id, filter, limit, cursor }) => {
      const acc = curviate.account(account_id);
      const targetUserId = userIdOrMe(user_id);
      const pageParams = { ...(limit !== undefined ? { limit } : {}), ...(cursor !== undefined ? { cursor } : {}) };

      switch (type) {
        case "connections":
          return runTool(() => {
            assertMeOnly(targetUserId, "list_network", "connections");
            return acc.users.listRelations({ ...pageParams, ...(filter !== undefined ? { filter } : {}) });
          });
        case "followers":
          return runTool(() => acc.users.listFollowers(targetUserId, pageParams));
        case "following":
          return runTool(() => {
            assertMeOnly(targetUserId, "list_network", "following");
            return acc.users.listFollowing("me", pageParams);
          });
      }
    },
  );

  const INSIGHT_SECTIONS = ["subscription", "analytics", "visitors", "ssi", "inmail_credits"] as const;

  server.registerTool(
    "get_my_insights",
    {
      title: "Get the caller's own profile insights",
      description:
        "Fetch the caller's own LinkedIn subscription plan, profile analytics, recent visitors, Social " +
        "Selling Index, and/or InMail credit balance. Own account only, do not confuse with get_account, " +
        "which reports Curviate connected-account state and quotas, not LinkedIn-side insights. Request one " +
        "or several sections in sections, each is fetched independently and merged into one object keyed by " +
        "section name.",
      inputSchema: {
        account_id: z.string().describe("The connected account id to read as."),
        sections: z
          .array(z.enum(INSIGHT_SECTIONS))
          .min(1)
          .describe("Which insight sections to fetch, at least one: subscription, analytics, visitors, ssi, inmail_credits."),
        service: z
          .enum(["classic", "recruiter", "sales_navigator"])
          .optional()
          .describe("inmail_credits section only: filter to one product's InMail credit count. Omit to return all three."),
        limit: z.number().int().min(1).max(100).optional().describe("visitors section only: results per page (default 20)."),
        cursor: z.string().optional().describe("visitors section only: opaque pagination cursor from a prior response."),
      },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ account_id, sections, service, limit, cursor }) =>
      runTool(async () => {
        const acc = curviate.account(account_id);
        const out: Record<string, unknown> = {};

        for (const section of sections) {
          switch (section) {
            case "subscription":
              out["subscription"] = await acc.profile.subscription();
              break;
            case "analytics":
              out["analytics"] = await acc.profile.analytics();
              break;
            case "visitors":
              out["visitors"] = await acc.profile.visitors({
                ...(limit !== undefined ? { limit } : {}),
                ...(cursor !== undefined ? { cursor } : {}),
              });
              break;
            case "ssi":
              out["ssi"] = await acc.profile.ssi();
              break;
            case "inmail_credits":
              out["inmail_credits"] = await acc.users.getInMailCredits(service !== undefined ? { service } : undefined);
              break;
          }
        }
        return out;
      }),
  );

  server.registerTool(
    "endorse_skill",
    {
      title: "Endorse a connection's skill",
      description:
        "Endorse one specific skill on a 1st-degree connection's profile. Only a connection's skills can be " +
        "endorsed, not a stranger's. Obtain endorsement_id by calling get_profile on the target with " +
        "linkedin_sections including linkedin_skills, then reading that skill's endorsement_id field, present " +
        "only when eligible to endorse it. Unlike follow_user or send_connection_request, this never changes " +
        "the connection graph, it only adds a skill endorsement.",
      inputSchema: {
        account_id: z.string().describe("The connected account id to endorse from."),
        user_id: z.string().describe("The 1st-degree connection's LinkedIn member id (ACo... format). A public identifier does not resolve on this endpoint."),
        endorsement_id: z
          .string()
          .describe("The endorsement id for the specific skill, from that skill's endorsement_id field on a get_profile read."),
      },
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async ({ account_id, user_id, endorsement_id }) =>
      runTool(() => curviate.account(account_id).users.endorseSkill(user_id, { endorsement_id })),
  );
}
