import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { type FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";

// Ensure environment fallback for testing
process.env.SUPABASE_URL = process.env.SUPABASE_URL || "https://thlpmhblgcdpgqhnrhkp.supabase.co";
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "sb_publishable_CgH5NoCBAL4hn-HgkUdmiQ_3iaKZJWA";

describe("Fastify Workspace Routes", () => {
  let app: FastifyInstance;

  before(async () => {
    app = await buildApp();
    await app.ready();
  });

  after(async () => {
    await app.close();
  });

  test("GET /health returns 200 ok", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/health",
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.status, "ok");
  });

  test("GET /workspaces rejects requests with missing Authorization header", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/workspaces",
    });

    assert.equal(res.statusCode, 401);
    const body = JSON.parse(res.body);
    assert.ok(body.error);
    assert.match(body.error, /Authorization/i);
  });

  test("GET /workspaces rejects requests with malformed Bearer token", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/workspaces",
      headers: {
        authorization: "Bearer invalid.fake.token",
      },
    });

    assert.equal(res.statusCode, 401);
    const body = JSON.parse(res.body);
    assert.ok(body.error);
  });

  test("GET /workspaces/:workspaceId rejects invalid UUIDs", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/workspaces/not-a-valid-uuid",
      headers: {
        authorization: "Bearer invalid.fake.token",
      },
    });

    // Should reject with 400 Bad Request on invalid UUID or 401 if auth fails first
    assert.ok(res.statusCode === 400 || res.statusCode === 401);
  });

  test("GET /workspaces/:workspaceId/membership rejects unauthenticated callers", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/workspaces/11111111-1111-1111-1111-111111111111/membership",
    });

    assert.equal(res.statusCode, 401);
    const body = JSON.parse(res.body);
    assert.ok(body.error);
    assert.match(body.error, /Authorization/i);
  });

  test("GET /workspaces/:workspaceId/members rejects unauthenticated callers", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/workspaces/11111111-1111-1111-1111-111111111111/members",
    });

    assert.equal(res.statusCode, 401);
    const body = JSON.parse(res.body);
    assert.ok(body.error);
    assert.match(body.error, /Authorization/i);
  });

  test("PATCH /workspaces/:workspaceId/members/:userId rejects unauthenticated callers", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/workspaces/11111111-1111-1111-1111-111111111111/members/22222222-2222-2222-2222-222222222222",
      payload: { role: "admin" },
    });

    assert.equal(res.statusCode, 401);
  });

  test("DELETE /workspaces/:workspaceId/members/:userId rejects unauthenticated callers", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: "/workspaces/11111111-1111-1111-1111-111111111111/members/22222222-2222-2222-2222-222222222222",
    });

    assert.equal(res.statusCode, 401);
  });

  test("GET /workspaces/:workspaceId/invitations rejects unauthenticated callers", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/workspaces/11111111-1111-1111-1111-111111111111/invitations",
    });

    assert.equal(res.statusCode, 401);
  });

  test("POST /workspaces/:workspaceId/invitations rejects unauthenticated callers", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/workspaces/11111111-1111-1111-1111-111111111111/invitations",
      payload: { email: "colleague@example.com", role: "editor" },
    });

    assert.equal(res.statusCode, 401);
  });

  test("DELETE /workspaces/:workspaceId/invitations/:invitationId rejects unauthenticated callers", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: "/workspaces/11111111-1111-1111-1111-111111111111/invitations/inv-123",
    });

    assert.equal(res.statusCode, 401);
  });

  test("GET /invitations/:token returns 404 for unknown or invalid invitation token", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/invitations/non-existent-token-abc-123",
    });

    assert.equal(res.statusCode, 404);
    const body = JSON.parse(res.body);
    assert.ok(body.error);
    assert.match(body.error, /Invitation not found/i);
  });

  test("POST /invitations/accept rejects unauthenticated callers", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/invitations/accept",
      payload: { token: "some-raw-token" },
    });

    assert.equal(res.statusCode, 401);
  });
});
