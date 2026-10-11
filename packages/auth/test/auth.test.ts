import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { verifySupabaseToken } from "../src/api.js";

describe("Authentication Utilities", () => {
  describe("verifySupabaseToken", () => {
    test("rejects empty token", async () => {
      const result = await verifySupabaseToken("");
      assert.equal(result.user, null);
      assert.ok(result.error);
      assert.match(result.error, /Missing or malformed/);
    });

    test("rejects malformed Bearer whitespace only token", async () => {
      const result = await verifySupabaseToken("Bearer    ");
      assert.equal(result.user, null);
      assert.ok(result.error);
      assert.match(result.error, /Missing or malformed/);
    });

    test("handles missing environment configuration gracefully", async () => {
      const originalUrl = process.env.SUPABASE_URL;
      const originalAnon = process.env.SUPABASE_ANON_KEY;
      const originalNextUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const originalNextAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      delete process.env.SUPABASE_URL;
      delete process.env.SUPABASE_ANON_KEY;
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      try {
        const result = await verifySupabaseToken("Bearer valid-looking-token");
        assert.equal(result.user, null);
        assert.ok(result.error);
        assert.match(result.error, /configuration is incomplete/);
      } finally {
        if (originalUrl) process.env.SUPABASE_URL = originalUrl;
        if (originalAnon) process.env.SUPABASE_ANON_KEY = originalAnon;
        if (originalNextUrl) process.env.NEXT_PUBLIC_SUPABASE_URL = originalNextUrl;
        if (originalNextAnon) process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalNextAnon;
      }
    });
  });
});
