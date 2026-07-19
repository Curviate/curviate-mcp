/**
 * Comment-write tool, backed by the SDK's `comments` resource.
 */
import type { Curviate } from "@curviate/sdk";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { runTool } from "../tool-result.js";

export function registerCommentTools(server: McpServer, curviate: Curviate): void {
  server.registerTool(
    "add_comment",
    {
      title: "Comment on a post",
      description:
        "Publish a comment on a LinkedIn post as the connected account. At most one image attachment is " +
        "accepted, matching LinkedIn's own one-image-per-comment limit.",
      inputSchema: {
        account_id: z.string().describe("The connected account id to comment as."),
        post_id: z
          .string()
          .describe("The post's id exactly as returned by get_post or search_posts. Other id forms are not accepted."),
        text: z.string().min(1).max(1250).describe("Comment body text (1-1250 chars). Inline @mentions live in the text."),
        comment_as: z.string().optional().describe("Publish as another user or company page id the account administers."),
        attachments: z
          .array(
            z.object({
              content: z.string().describe("Base64-encoded file bytes."),
              content_type: z.string().describe("Attachment MIME type (e.g. image/png)."),
              filename: z.string().describe("File name for the attachment."),
            }),
          )
          .max(1)
          .optional()
          .describe("At most one base64 image attachment."),
      },
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async ({ account_id, post_id, ...body }) =>
      runTool(() => curviate.account(account_id).comments.create(post_id, body)),
  );

  server.registerTool(
    "update_comment",
    {
      title: "Update a comment",
      description:
        "Edit the text of a comment the connected account authored. Own comments only. Use add_comment " +
        "instead to post a new comment or reply rather than edit an existing one.",
      inputSchema: {
        account_id: z.string().describe("The connected account id that authored the comment."),
        post_id: z
          .string()
          .describe("The post's id exactly as returned by get_post or search_posts. Other id forms are not accepted."),
        comment_id: z.string().describe("The comment's id, as returned by add_comment or list_post_engagement."),
        text: z.string().min(1).max(1250).describe("Updated comment body text (1-1250 chars)."),
      },
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async ({ account_id, post_id, comment_id, text }) =>
      runTool(() => curviate.account(account_id).comments.edit(post_id, comment_id, { text })),
  );

  server.registerTool(
    "delete_comment",
    {
      title: "Delete a comment",
      description:
        "Delete a comment the connected account authored. Own comments only. This cannot be undone, " +
        "LinkedIn provides no restore mechanism once a comment is deleted.",
      inputSchema: {
        account_id: z.string().describe("The connected account id that authored the comment."),
        post_id: z
          .string()
          .describe("The post's id exactly as returned by get_post or search_posts. Other id forms are not accepted."),
        comment_id: z.string().describe("The comment's id, as returned by add_comment or list_post_engagement."),
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ account_id, post_id, comment_id }) =>
      runTool(() => curviate.account(account_id).comments.delete(post_id, comment_id)),
  );
}
