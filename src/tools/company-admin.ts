/**
 * Company Admin tools, backed by the SDK's `companies` resource. Read and
 * reply to a company page's admin message inbox, and invite connections to
 * follow a page. The connected account must administer the target page
 * (from list_managed_companies); an account that does not gets a structured
 * RESOURCE_ACCESS_RESTRICTED error before anything is read or sent. Beta:
 * single-page listing and termination are verified, deep pagination against
 * a busy inbox is provisional.
 */
import type { Curviate } from "@curviate/sdk";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { runTool } from "../tool-result.js";

const companyIdentifierField = z
  .string()
  .describe("The administered company page's numeric id, from list_managed_companies or get_company.");

const attachment = z.object({
  content: z.string().describe("Base64-encoded file bytes."),
  content_type: z.string().describe("Attachment MIME type (e.g. image/png, application/pdf)."),
  filename: z.string().describe("File name for the attachment."),
});

export function registerCompanyAdminTools(server: McpServer, curviate: Curviate): void {
  server.registerTool(
    "list_company_chats",
    {
      title: "List a company page's inbox chats",
      description:
        "List conversations in a company page's admin inbox, newest-activity-first. Pass query, topic, or " +
        "unread to search/filter (mutually exclusive); omit all three to list every chat. Chat ids chain into " +
        "read_company_chat and reply_company_chat. This is the page's inbox, not the caller's own, use " +
        "list_chats for the connected member's personal inbox.",
      inputSchema: {
        account_id: z.string().describe("The connected account id, which must administer the page."),
        identifier: companyIdentifierField,
        query: z.string().optional().describe("Free-text search across chat participants and message content. Mutually exclusive with topic/unread."),
        topic: z
          .string()
          .optional()
          .describe("Filter to one inbox topic card: 1-5 or its name (Service request, Request a demo, Support, Careers, Other). Mutually exclusive with query/unread."),
        unread: z.boolean().optional().describe("Filter to unread chats only. Mutually exclusive with query/topic."),
        limit: z.number().int().min(1).max(50).optional().describe("Results per page (1-50, default 20)."),
        cursor: z.string().optional().describe("Opaque pagination cursor from a prior response."),
      },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ account_id, identifier, query, topic, unread, limit, cursor }) => {
      const acc = curviate.account(account_id);
      const params = {
        ...(limit !== undefined ? { limit } : {}),
        ...(cursor !== undefined ? { cursor } : {}),
      };
      if (query !== undefined || topic !== undefined || unread !== undefined) {
        return runTool(() =>
          acc.companies.searchChats(identifier, {
            ...params,
            ...(query !== undefined ? { query } : {}),
            ...(topic !== undefined ? { topic } : {}),
            ...(unread !== undefined ? { unread } : {}),
          }),
        );
      }
      return runTool(() => acc.companies.chats(identifier, params));
    },
  );

  server.registerTool(
    "read_company_chat",
    {
      title: "Read a company page's inbox chat, or a message within it",
      description:
        "Read a company page's admin inbox chat, not the caller's own personal inbox, use read_chat for that. " +
        "By default returns the latest page of messages in the chat. Pass message_id to fetch one specific " +
        "message instead, or section 'details' to fetch the chat's own metadata (participants, unread state) " +
        "instead of its messages. Reply with reply_company_chat.",
      inputSchema: {
        account_id: z.string().describe("The connected account id, which must administer the page."),
        identifier: companyIdentifierField,
        chat_id: z.string().describe("The chat's id, from list_company_chats."),
        message_id: z
          .string()
          .optional()
          .describe("A specific message's id within the chat, as returned by a prior read_company_chat call. Returns that single message only."),
        section: z
          .enum(["details"])
          .optional()
          .describe("Pass 'details' to fetch the chat's own metadata instead of its messages. Ignored when message_id is supplied."),
        limit: z.number().int().min(1).max(50).optional().describe("Results per page (1-50, default 20). Messages page only."),
        cursor: z.string().optional().describe("Opaque pagination cursor from a prior response. Messages page only."),
      },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ account_id, identifier, chat_id, message_id, section, limit, cursor }) => {
      const acc = curviate.account(account_id);
      if (message_id !== undefined) {
        return runTool(() => acc.companies.message(identifier, chat_id, message_id));
      }
      if (section === "details") {
        return runTool(() => acc.companies.chat(identifier, chat_id));
      }
      return runTool(() =>
        acc.companies.messages(identifier, chat_id, {
          ...(limit !== undefined ? { limit } : {}),
          ...(cursor !== undefined ? { cursor } : {}),
        }),
      );
    },
  );

  server.registerTool(
    "reply_company_chat",
    {
      title: "Reply to a company inbox conversation as the page",
      description:
        "Send a message into an existing company-inbox conversation, replying as the page rather than the " +
        "connected member. chat_id is the id list_company_chats/read_company_chat returns, passed verbatim. " +
        "This is reply-only, a page can never start a new conversation, only answer an existing one, so it is " +
        "never a substitute for send_message on a personal chat. At least one of text or attachments is " +
        "required.",
      inputSchema: {
        account_id: z.string().describe("The connected account id, which must administer the page."),
        identifier: companyIdentifierField,
        chat_id: z.string().describe("The conversation id from list_company_chats or read_company_chat, passed verbatim."),
        text: z.string().max(8000).optional().describe("Message text. Optional if at least one attachment is given."),
        quote_id: z.string().optional().describe("Optional message id to quote or reply to."),
        attachments: z.array(attachment).optional().describe("Optional file attachments."),
      },
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async ({ account_id, identifier, chat_id, ...body }) =>
      runTool(() => curviate.account(account_id).companies.sendMessage(identifier, chat_id, body)),
  );

  server.registerTool(
    "invite_followers",
    {
      title: "Invite connections to follow a company page",
      description:
        "Invite one or more of the connected account's 1st-degree connections to follow a page it " +
        "administers with the invite-to-follow entitlement. Pass the member ids from a browse_company " +
        "invitable_followers read. All-or-nothing: for an all-valid request, resolves to one outcome per " +
        "invitee in request order; if any invitee id is invalid the whole request is rejected rather than " +
        "partially succeeding. Re-inviting an already-invited member is a safe no-op.",
      inputSchema: {
        account_id: z.string().describe("The connected account id, which must administer the page with invite rights."),
        identifier: companyIdentifierField,
        invitee_ids: z
          .array(z.string())
          .min(1)
          .max(50)
          .describe("Member ids to invite to follow the page, from a browse_company invitable_followers read. 1-50 per request."),
      },
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async ({ account_id, identifier, invitee_ids }) =>
      runTool(() => curviate.account(account_id).companies.followInvite(identifier, { invitee_ids })),
  );
}
