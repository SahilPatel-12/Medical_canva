import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { verifyAdminAuth } from "../src/index.js";

describe("Admin Authorization Guardrails (Phase 0)", () => {
  const DEFAULT_SECRET = "mc_admin_dev_secret_2026";

  test("rejects requests missing administrative credentials", async () => {
    const result = await verifyAdminAuth({});
    assert.equal(result.authorized, false);
    assert.ok(result.error?.includes("Missing administrative credentials"));
  });

  test("rejects invalid admin API secret keys", async () => {
    const result = await verifyAdminAuth({
      "x-admin-key": "invalid_wrong_secret",
    });
    assert.equal(result.authorized, false);
    assert.ok(result.error?.includes("Missing administrative credentials"));
  });

  test("authorizes requests with valid x-admin-key matching ADMIN_API_SECRET", async () => {
    const result = await verifyAdminAuth({
      "x-admin-key": DEFAULT_SECRET,
    });
    assert.equal(result.authorized, true);
    assert.equal(result.role, "admin");
    assert.equal(result.userId, "system-admin");
  });

  test("authorizes requests with x-admin-key matching SUPABASE_SERVICE_ROLE_KEY", async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test_service_role_key_supabase";
    try {
      const result = await verifyAdminAuth({
        "x-admin-key": "test_service_role_key_supabase",
      });
      assert.equal(result.authorized, true);
      assert.equal(result.role, "admin");
    } finally {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    }
  });

  test("does not trust spoofed client-supplied role headers", async () => {
    const result = await verifyAdminAuth({
      "x-role": "admin",
      "x-is-admin": "true",
      "x-user-role": "superadmin",
    });
    assert.equal(result.authorized, false);
  });
});
