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
      // Sales Navigator
      "sn_search_people",
      "sn_search_companies",
      "sn_search_from_url",
      "sn_get_profile",
      "sn_start_chat",
      "sn_list_lists",
      "sn_save_lead",
      "sn_save_account",
      // Recruiter
      "rec_search_candidates",
      "rec_search_talent_pool",
      "rec_search_from_url",
      "rec_get_profile",
      "rec_start_chat",
      "rec_list_projects",
      "rec_edit_project",
      "rec_list_pipeline",
      "rec_save_candidate",
      "rec_list_applicants",
      "rec_list_jobs",
      "rec_create_job_draft",
      "rec_edit_job",
      "rec_transition_job",
      // Company Admin
      "list_company_chats",
      "read_company_chat",
      "reply_company_chat",
      "invite_followers",
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

  it("calls a Sales Navigator tool (sn_get_profile) against a mocked SDK", async () => {
    const fakeProfileFetch: typeof fetch = async () =>
      new Response(JSON.stringify({ object: "profile", id: "ACoAAtest" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });

    const server = createServer({ apiKey: "cvt_test_fake_key", version: "0.1.0", fetch: fakeProfileFetch });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "smoke-test-client", version: "0.0.0" });

    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const result = await client.callTool({
      name: "sn_get_profile",
      arguments: { account_id: "acc_test", identifier: "ACoAAtest" },
    });

    expect(result.isError).toBeFalsy();
    const content = result.content as Array<{ type: string; text: string }>;
    const parsed = JSON.parse(content[0]?.text ?? "{}") as { object?: string; id?: string };
    expect(parsed.object).toBe("profile");
    expect(parsed.id).toBe("ACoAAtest");

    await client.close();
    await server.close();
  });

  it("rec_list_projects dispatches to the single-project read when project_id is supplied, not the list read", async () => {
    const calledUrls: string[] = [];
    const fakeFetch: typeof fetch = async (input) => {
      calledUrls.push(typeof input === "string" ? input : input.toString());
      return new Response(JSON.stringify({ object: "recruiter_project", id: "proj_1" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };

    const server = createServer({ apiKey: "cvt_test_fake_key", version: "0.1.0", fetch: fakeFetch });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "smoke-test-client", version: "0.0.0" });

    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const result = await client.callTool({
      name: "rec_list_projects",
      arguments: { account_id: "acc_test", project_id: "proj_1" },
    });

    expect(result.isError).toBeFalsy();
    expect(calledUrls).toHaveLength(1);
    expect(calledUrls[0]).toContain("/recruiter/projects/proj_1");
    expect(calledUrls[0]).not.toMatch(/\/recruiter\/projects\?/);

    await client.close();
    await server.close();
  });

  it("list_company_chats dispatches to search when a filter is supplied, not the plain list", async () => {
    const calledUrls: string[] = [];
    const fakeFetch: typeof fetch = async (input) => {
      calledUrls.push(typeof input === "string" ? input : input.toString());
      return new Response(JSON.stringify({ object: "company_chat_list", items: [], cursor: null }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };

    const server = createServer({ apiKey: "cvt_test_fake_key", version: "0.1.0", fetch: fakeFetch });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "smoke-test-client", version: "0.0.0" });

    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const result = await client.callTool({
      name: "list_company_chats",
      arguments: { account_id: "acc_test", identifier: "112013061", unread: true },
    });

    expect(result.isError).toBeFalsy();
    expect(calledUrls).toHaveLength(1);
    expect(calledUrls[0]).toContain("/companies/112013061/chats/search");

    await client.close();
    await server.close();
  });

  it("rec_transition_job requires mode when action is publish, without calling the SDK", async () => {
    let fetchCalled = false;
    const fakeFetch: typeof fetch = async () => {
      fetchCalled = true;
      return new Response(JSON.stringify({}), { status: 200, headers: { "content-type": "application/json" } });
    };

    const server = createServer({ apiKey: "cvt_test_fake_key", version: "0.1.0", fetch: fakeFetch });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "smoke-test-client", version: "0.0.0" });

    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const result = await client.callTool({
      name: "rec_transition_job",
      arguments: { account_id: "acc_test", project_id: "proj_1", job_id: "job_1", action: "publish" },
    });

    expect(result.isError).toBe(true);
    const content = result.content as Array<{ type: string; text: string }>;
    const parsed = JSON.parse(content[0]?.text ?? "{}") as { code?: string; message?: string };
    expect(parsed.code).toBe("INVALID_REQUEST");
    expect(parsed.message).toMatch(/mode is required/i);
    expect(fetchCalled).toBe(false);

    await client.close();
    await server.close();
  });
});
