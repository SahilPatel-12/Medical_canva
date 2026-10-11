import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { type FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";

process.env.SUPABASE_URL = process.env.SUPABASE_URL || "https://thlpmhblgcdpgqhnrhkp.supabase.co";
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "sb_publishable_CgH5NoCBAL4hn-HgkUdmiQ_3iaKZJWA";

describe("Fastify Design Sharing & Collaboration Routes", () => {
  let app: FastifyInstance;

  before(async () => {
    app = await buildApp();
    await app.ready();
  });

  after(async () => {
    await app.close();
  });

  describe("Public Resolution: GET /share/:token", () => {
    test("GET /share/:token returns 404 for non-existent token", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/share/non-existent-token-xyz-123",
      });

      assert.equal(res.statusCode, 404);
      const body = JSON.parse(res.body);
      assert.ok(body.error);
      assert.match(body.error, /Share link not found/i);
    });
  });

  describe("Authenticated Shared Writes: POST /share/:token/update", () => {
    test("POST /share/:token/update rejects unauthenticated caller with 401", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/share/some-token/update",
        payload: {
          designId: "des-123",
          pages: [],
        },
      });

      assert.equal(res.statusCode, 401);
      const body = JSON.parse(res.body);
      assert.ok(body.error);
      assert.match(body.error, /Authorization/i);
    });
  });

  describe("Share Settings Management: /designs/:id/share", () => {
    test("GET /designs/:id/share rejects unauthenticated caller with 401", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/designs/des-123/share",
      });

      assert.equal(res.statusCode, 401);
      const body = JSON.parse(res.body);
      assert.ok(body.error);
    });

    test("POST /designs/:id/share rejects unauthenticated caller with 401", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/designs/des-123/share",
        payload: {
          isEnabled: true,
          permission: "edit",
        },
      });

      assert.equal(res.statusCode, 401);
      const body = JSON.parse(res.body);
      assert.ok(body.error);
    });
  });
});
