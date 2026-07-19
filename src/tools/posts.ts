/**
 * Post read/write/reaction tools, backed by the SDK's `posts` resource.
 */
import type { Curviate } from "@curviate/sdk";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { runTool } from "../tool-result.js";

const REACTIONS = ["like", "celebrate", "support", "love", "insightful", "funny"] as const;

export function registerPostTools(server: McpServer, curviate: Curviate): void {
  server.registerTool(
    "get_post",
    {
      title: "Get a post",
      description: "Retrieve a single LinkedIn post's full detail, including text, engagement counts, and author.",
      inputSchema: {
        account_id: z.string().describe("The connected account id to read as."),
        post_id: z.string().describe("The post's opaque id, from search_posts or a feed/profile listing."),
      },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ account_id, post_id }) => runTool(() => curviate.account(account_id).posts.get(post_id)),
  );

  server.registerTool(
    "create_post",
    {
      title: "Publish a post",
      description:
        "Publish a new LinkedIn post as the connected account. Attachments (if any) are base64-encoded objects; " +
        "multiple images produce a carousel, a document/PDF produces a document post. Pass quoted_post_id to " +
        "repost (empty text) or quote-post (non-empty text) another post.",
      inputSchema: {
        account_id: z.string().describe("The connected account id to post as."),
        text: z.string().min(1).max(3000).describe("Post body text (1-3000 chars). Inline @mentions live in the text."),
        attachments: z
          .array(
            z.object({
              content: z.string().describe("Base64-encoded file bytes."),
              content_type: z.string().describe("Attachment MIME type (e.g. image/png, application/pdf)."),
              filename: z.string().describe("File name for the attachment."),
            }),
          )
          .optional()
          .describe("Media attachments."),
        quoted_post_id: z.string().optional().describe("A post_id to quote or repost."),
        can_read: z.enum(["anyone", "relations_only"]).optional().describe("Who can read the post."),
        can_comment: z.enum(["anyone", "relations_only", "no_one"]).optional().describe("Who may comment."),
        post_as: z.string().optional().describe("Company page id to post as. The account must administer it."),
      },
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async ({ account_id, ...body }) => runTool(() => curviate.account(account_id).posts.create(body)),
  );

  server.registerTool(
    "add_reaction",
    {
      title: "React to a post",
      description:
        "Add this account's reaction to a post: like, celebrate, support, love, insightful, or funny. Pass " +
        "react_as to react as a company page the account administers.",
      inputSchema: {
        account_id: z.string().describe("The connected account id to react from."),
        post_id: z
          .string()
          .describe("The post's id exactly as returned by get_post or search_posts. Other id forms are not accepted."),
        reaction: z.enum(REACTIONS).describe("Reaction type."),
        react_as: z.string().optional().describe("Company page id to react as. The account must administer it."),
      },
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async ({ account_id, post_id, ...body }) =>
      runTool(() => curviate.account(account_id).posts.react(post_id, body)),
  );

  server.registerTool(
    "remove_reaction",
    {
      title: "Remove a reaction from a post",
      description:
        "Remove this account's reaction from a post. Returns REACTION_NOT_FOUND if the account never " +
        "reacted with that exact value. This cannot be undone once it succeeds. Use add_reaction instead to " +
        "add a reaction rather than remove one.",
      inputSchema: {
        account_id: z.string().describe("The connected account id to remove the reaction from."),
        post_id: z
          .string()
          .describe("The post's id exactly as returned by get_post or search_posts. Other id forms are not accepted."),
        reaction: z.enum(REACTIONS).describe("The reaction value to remove."),
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ account_id, post_id, reaction }) =>
      runTool(() => curviate.account(account_id).posts.unreact(post_id, { reaction })),
  );

  server.registerTool(
    "delete_post",
    {
      title: "Delete a post",
      description:
        "Delete a post owned by the connected account. Own posts only. This cannot be undone, LinkedIn " +
        "provides no restore mechanism once a post is deleted.",
      inputSchema: {
        account_id: z.string().describe("The connected account id that owns the post."),
        post_id: z
          .string()
          .describe(
            "The post's id, as returned by get_post or list_profile_activity. A full LinkedIn share URL, a bare numeric id, or a urn:li:activity:/ugcPost:/share: form is also accepted.",
          ),
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ account_id, post_id }) => runTool(() => curviate.account(account_id).posts.delete(post_id)),
  );

  server.registerTool(
    "save_post",
    {
      title: "Save or unsave a post",
      description:
        "Save a post to the connected account's private bookmark list, or remove it, chosen by action. Any " +
        "post may be saved, saving never notifies the author and is never visible to third parties. Removing " +
        "a post that was never saved is a safe no-op that still returns success.",
      inputSchema: {
        account_id: z.string().describe("The connected account id whose bookmark list to update."),
        post_id: z
          .string()
          .describe("The post to save or unsave. Accepts urn:li:activity:<id> or a bare numeric <id>, both normalize to the same target."),
        action: z.enum(["save", "unsave"]).describe("Whether to save the post or remove it from the bookmark list."),
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ account_id, post_id, action }) => {
      const acc = curviate.account(account_id);
      if (action === "unsave") {
        return runTool(() => acc.posts.unsave(post_id));
      }
      return runTool(() => acc.posts.save(post_id));
    },
  );

  server.registerTool(
    "list_post_engagement",
    {
      title: "List a post's or comment's comments/replies or reactions",
      description:
        "List engagement on a post: its top-level comments or its reactions, selected with type. Pass " +
        "comment_id to list that specific comment's replies or reactions instead of the post's own. Use " +
        "get_post to read the post body itself, not its engagement.",
      inputSchema: {
        account_id: z.string().describe("The connected account id to read as."),
        post_id: z
          .string()
          .describe("The post's id exactly as returned by get_post or search_posts. Other id forms are not accepted."),
        type: z.enum(["comments", "reactions"]).describe("Which engagement to list: comments or reactions."),
        comment_id: z
          .string()
          .optional()
          .describe(
            "A specific comment's id, as returned by a prior list_post_engagement call. When supplied, lists that comment's replies (type comments) or reactions (type reactions) instead of the post's own.",
          ),
        limit: z.number().int().min(1).max(100).optional().describe("Results per page (1-100, default 20)."),
        cursor: z.string().optional().describe("Opaque pagination cursor from a prior response."),
      },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ account_id, post_id, type, comment_id, limit, cursor }) => {
      const acc = curviate.account(account_id);
      const params = { ...(limit !== undefined ? { limit } : {}), ...(cursor !== undefined ? { cursor } : {}) };

      if (type === "comments") {
        if (comment_id !== undefined) {
          return runTool(() => acc.comments.listReplies(post_id, comment_id, params));
        }
        return runTool(() => acc.posts.listComments(post_id, params));
      }
      if (comment_id !== undefined) {
        return runTool(() => acc.comments.listReactions(post_id, comment_id, params));
      }
      return runTool(() => acc.posts.listReactions(post_id, params));
    },
  );
}
