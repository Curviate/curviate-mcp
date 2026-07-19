/**
 * Messaging tools, backed by the SDK's `messaging` resource.
 */
import type { Curviate } from "@curviate/sdk";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { runTool } from "../tool-result.js";

const attachment = z.object({
  content: z.string().describe("Base64-encoded file bytes."),
  content_type: z.string().describe("Attachment MIME type (e.g. image/png, application/pdf)."),
  filename: z.string().describe("File name for the attachment."),
});

export function registerMessagingTools(server: McpServer, curviate: Curviate): void {
  server.registerTool(
    "list_chats",
    {
      title: "List chats",
      description:
        "List the connected account's conversations, newest-activity-first. Filter by inbox (primary, inmail, " +
        "archived, spam, jobs, starred), read status, conversation type, or a time window.",
      inputSchema: {
        account_id: z.string().describe("The connected account id whose chats to list."),
        inbox: z
          .enum(["primary", "inmail", "archived", "spam", "jobs", "starred"])
          .optional()
          .describe("Which inbox to list from. Defaults to primary."),
        unread: z.boolean().optional().describe("true for unread-only, false for read-only, omit for all."),
        type: z.enum(["1to1", "group", "channel"]).optional().describe("Filter by conversation type."),
        before: z.string().optional().describe("ISO-8601 UTC datetime, exclusive upper bound."),
        after: z.string().optional().describe("ISO-8601 UTC datetime, exclusive lower bound."),
        limit: z.number().int().min(1).max(25).optional().describe("Results per page (1-25, default 20)."),
        cursor: z.string().optional().describe("Opaque pagination cursor from a prior response."),
      },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ account_id, ...params }) => runTool(() => curviate.account(account_id).messaging.listChats(params)),
  );

  server.registerTool(
    "read_chat",
    {
      title: "Read a chat's messages",
      description:
        "List the messages in one chat, newest first, cursor-paginated. Message text is returned verbatim " +
        "(pass-through content, never persisted). Use the chat_id from list_chats.",
      inputSchema: {
        account_id: z.string().describe("The connected account id that owns the chat."),
        chat_id: z.string().describe("The chat id, from list_chats."),
        user_id: z.string().optional().describe("Filter to messages from this sender id only."),
        before: z.string().optional().describe("ISO-8601 UTC datetime, exclusive upper bound."),
        after: z.string().optional().describe("ISO-8601 UTC datetime, exclusive lower bound."),
        limit: z.number().int().min(1).max(25).optional().describe("Results per page (1-25, default 20)."),
        cursor: z.string().optional().describe("Opaque pagination cursor from a prior response."),
      },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ account_id, chat_id, ...params }) =>
      runTool(() => curviate.account(account_id).messaging.listMessages(chat_id, params)),
  );

  server.registerTool(
    "start_chat",
    {
      title: "Start a new chat",
      description:
        "Start a new conversation with one or more LinkedIn members and send the opening message in the same " +
        "call. Company pages are reply-only and cannot be started this way, use send_message on an existing " +
        "COMPANY_ chat id instead.",
      inputSchema: {
        account_id: z.string().describe("The connected account id to send from."),
        attendees_ids: z.array(z.string()).min(1).describe("LinkedIn member provider ids for the recipients."),
        text: z.string().min(1).max(8000).describe("Opening message text (1-8000 chars)."),
        subject: z.string().max(200).optional().describe("Optional conversation name or subject line."),
        attachments: z.array(attachment).optional().describe("Optional file attachments."),
        topic: z
          .enum(["service_request", "request_demo", "support", "careers", "other"])
          .optional()
          .describe("Required when starting a conversation with a company."),
        applicant_id: z.string().optional().describe("Required when messaging a job applicant."),
        invitation_id: z.string().optional().describe("Required when messaging a member with a pending invitation."),
        inmail: z.boolean().optional().describe("When true, starts the conversation as an InMail."),
      },
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async ({ account_id, ...body }) => runTool(() => curviate.account(account_id).messaging.startChat(body)),
  );

  server.registerTool(
    "send_message",
    {
      title: "Send a message",
      description:
        "Send a message into an existing chat. Pass a COMPANY_ chat id (from list_chats on a company inbox) to " +
        "reply as that page; any other chat id sends as the connected member. At least one of text or " +
        "attachments is required.",
      inputSchema: {
        account_id: z.string().describe("The connected account id to send from."),
        chat_id: z.string().describe("The chat id to send into, from list_chats."),
        text: z.string().max(8000).optional().describe("Message text. Optional if at least one attachment is given."),
        quote_id: z.string().optional().describe("Optional message id to quote or reply to."),
        attachments: z.array(attachment).optional().describe("Optional file attachments."),
      },
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async ({ account_id, chat_id, ...body }) =>
      runTool(() => curviate.account(account_id).messaging.sendMessage(chat_id, body)),
  );
}
