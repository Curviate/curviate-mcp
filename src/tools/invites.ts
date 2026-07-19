/**
 * Connection-request tools, backed by the SDK's `invites` resource.
 */
import type { Curviate } from "@curviate/sdk";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { runTool } from "../tool-result.js";

export function registerInviteTools(server: McpServer, curviate: Curviate): void {
  server.registerTool(
    "list_invitations",
    {
      title: "List connect-requests",
      description:
        "List the connected account's connect-requests, either received (pending invitations to respond to) or " +
        "sent (pending invitations awaiting a reply). Defaults to received.",
      inputSchema: {
        account_id: z.string().describe("The connected account id whose connect-requests to list."),
        direction: z
          .enum(["received", "sent"])
          .optional()
          .default("received")
          .describe("Which side of the connect-request to list. Defaults to received."),
        limit: z.number().int().min(1).max(100).optional().describe("Results per page (1-100, default 20)."),
        cursor: z.string().optional().describe("Opaque pagination cursor from a prior response."),
      },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ account_id, direction, ...params }) => {
      const acc = curviate.account(account_id);
      if (direction === "sent") {
        return runTool(() => acc.invites.listSent(params));
      }
      return runTool(() => acc.invites.listReceived(params));
    },
  );

  server.registerTool(
    "send_connection_request",
    {
      title: "Send a connect-request",
      description:
        "Send a LinkedIn connect-request (invitation) to a member. Include a short, specific, human-plausible " +
        "note, a generic or templated note reads as automation. Do not resend to a recipient already pending or " +
        "already connected.",
      inputSchema: {
        account_id: z.string().describe("The connected account id to send from."),
        recipient_identifier: z.string().describe("The recipient's LinkedIn public identifier (vanity slug) or member URN."),
        message: z.string().max(300).optional().describe("Optional connect-request note (up to 300 characters)."),
      },
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async ({ account_id, ...body }) => runTool(() => curviate.account(account_id).invites.send(body)),
  );

  server.registerTool(
    "respond_to_invitation",
    {
      title: "Respond to a connect-request",
      description:
        "Accept or decline a connect-request this account received. An unrecognized or already-resolved " +
        "invitation_id returns a not_found status rather than an error.",
      inputSchema: {
        account_id: z.string().describe("The connected account id that received the connect-request."),
        invitation_id: z.string().describe("The received connect-request's id, from list_invitations."),
        action: z.enum(["accept", "decline"]).describe("Whether to accept or decline the connect-request."),
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ account_id, invitation_id, action }) => {
      const acc = curviate.account(account_id);
      if (action === "accept") {
        return runTool(() => acc.invites.accept(invitation_id));
      }
      return runTool(() => acc.invites.decline(invitation_id));
    },
  );
}
