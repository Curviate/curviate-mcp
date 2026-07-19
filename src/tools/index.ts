/**
 * Tool-surface aggregation.
 *
 * v1 shipped the highest-value core read + core write tools (~19). Additional
 * tool groups land incrementally, one file per group, each registered here.
 * See the README's Roadmap section for what is planned next.
 */
import type { Curviate } from "@curviate/sdk";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAccountTools } from "./accounts.js";
import { registerUserTools } from "./users.js";
import { registerProfileTools } from "./profile.js";
import { registerFollowingTools } from "./following.js";
import { registerSearchTools } from "./search.js";
import { registerCompanyTools } from "./companies.js";
import { registerMessagingTools } from "./messaging.js";
import { registerFeedTools } from "./feed.js";
import { registerNotificationTools } from "./notifications.js";
import { registerPostTools } from "./posts.js";
import { registerCommentTools } from "./comments.js";
import { registerInviteTools } from "./invites.js";
import { registerJobTools } from "./jobs.js";
import { registerGroupTools } from "./groups.js";

export function registerAllTools(server: McpServer, curviate: Curviate): void {
  registerAccountTools(server, curviate);
  registerUserTools(server, curviate);
  registerProfileTools(server, curviate);
  registerFollowingTools(server, curviate);
  registerSearchTools(server, curviate);
  registerCompanyTools(server, curviate);
  registerMessagingTools(server, curviate);
  registerFeedTools(server, curviate);
  registerNotificationTools(server, curviate);
  registerPostTools(server, curviate);
  registerCommentTools(server, curviate);
  registerInviteTools(server, curviate);
  registerJobTools(server, curviate);
  registerGroupTools(server, curviate);
}
