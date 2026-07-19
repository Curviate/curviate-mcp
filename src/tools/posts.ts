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
}
