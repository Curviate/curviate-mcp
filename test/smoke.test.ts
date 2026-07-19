import { describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../src/server.js";

describe("curviate-mcp server", () => {
  it("boots over an in-memory transport pair and serves the v1 tool surface", async () => {
    const server = createServer({ apiKey: "cvt_test_fake_key", version: "0.1.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "smoke-test-client", version: "0.0.0" });

    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const { tools } = await client.listTools();
    const names = tools.map((tool) => tool.name);

    const expectedNames = [
      // v1
      "list_accounts",
      "get_account",
      "get_profile",
      "search_people",
      "search_companies",
      "search_posts",
      "search_jobs",
      "get_company",
      "list_chats",
      "read_chat",
      "send_message",
      "start_chat",
      "get_feed",
      "get_post",
      "create_post",
      "add_comment",
      "add_reaction",
      "list_invitations",
      "send_connection_request",
      "respond_to_invitation",
      // profile extras
      "update_my_profile",
      "list_profile_activity",
      "list_network",
      "get_my_insights",
      "endorse_skill",
      // following
      "follow_user",
      "unfollow_user",
      // companies
      "browse_company",
      "list_managed_companies",
      // messaging extras
      "edit_message",
      "delete_message",
      "react_to_message",
      "update_chat",
      // notifications
      "list_notifications",
      "dismiss_notification",
      // posts extras
      "delete_post",
      "list_post_engagement",
      "update_comment",
      "delete_comment",
      "remove_reaction",
      "save_post",
      // invites extras
      "withdraw_invitation",
      // jobs
      "list_jobs",
      "get_job",
      "create_job_draft",
      "edit_job",
      "transition_job",
      "list_job_applicants",
      // search extras
      "search_services",
      "search_from_url",
      "search_groups",
      "list_group_members",
    ];

    for (const expected of expectedNames) {
      expect(names).toContain(expected);
    }
    expect(names.length).toBe(expectedNames.length);

    // Every tool declares an input schema and a readOnlyHint/destructiveHint
    // annotation, both required by the spec for the AX bar to hold.
    for (const tool of tools) {
      expect(tool.inputSchema).toBeDefined();
      expect(tool.annotations).toBeDefined();
      expect(typeof tool.annotations?.readOnlyHint).toBe("boolean");
      expect(typeof tool.annotations?.destructiveHint).toBe("boolean");
    }

    await client.close();
    await server.close();
  });

  it("surfaces a structured CurviateError (isError, not a thrown exception) on a failing call", async () => {
    const fakeUnauthorizedFetch: typeof fetch = async () =>
      new Response(JSON.stringify({ code: "UNAUTHORIZED", message: "Invalid API key." }), {
        status: 401,
        headers: { "content-type": "application/json" },
      });

    const server = createServer({
      apiKey: "cvt_test_fake_key",
      version: "0.1.0",
      fetch: fakeUnauthorizedFetch,
    });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "smoke-test-client", version: "0.0.0" });

    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const result = await client.callTool({
      name: "list_accounts",
      arguments: {},
    });

    expect(result.isError).toBe(true);
    const content = result.content as Array<{ type: string; text: string }>;
    const parsed = JSON.parse(content[0]?.text ?? "{}") as { name?: string; code?: string };
    expect(parsed.name).toBe("CurviateError");
    expect(parsed.code).toBe("UNAUTHORIZED");

    await client.close();
    await server.close();
  });

  it("calls a tool from the new tranche (follow_user) against a mocked SDK", async () => {
    const fakeFollowFetch: typeof fetch = async () =>
      new Response(JSON.stringify({ object: "user_followed" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });

    const server = createServer({
      apiKey: "cvt_test_fake_key",
      version: "0.1.0",
      fetch: fakeFollowFetch,
    });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "smoke-test-client", version: "0.0.0" });

    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const result = await client.callTool({
      name: "follow_user",
      arguments: { account_id: "acc_test", user_id: "ACoAAtest" },
    });

    expect(result.isError).toBeFalsy();
    const content = result.content as Array<{ type: string; text: string }>;
    const parsed = JSON.parse(content[0]?.text ?? "{}") as { object?: string };
    expect(parsed.object).toBe("user_followed");

    await client.close();
    await server.close();
  });
});
