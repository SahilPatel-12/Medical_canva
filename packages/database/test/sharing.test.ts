import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { SupabaseShareRepository } from "../src/index.js";

describe("Phase 4: Design Link Sharing & Real-Time Collaboration Access Control", () => {
  const DESIGN_ID = "design-abc-123";
  const RAW_TOKEN = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

  describe("getOrCreateShareLink", () => {
    test("rejects missing design ID", async () => {
      const mockClient = {
        rpc: () => Promise.resolve({ data: null, error: null }),
      };
      // @ts-expect-error mock client
      const repo = new SupabaseShareRepository({ client: mockClient });

      await assert.rejects(() => repo.getOrCreateShareLink(""), /Design ID is required/);
    });

    test("invokes get_or_create_design_share_link RPC and returns link details", async () => {
      let rpcName = "";
      let rpcParams: Record<string, unknown> = {};

      const mockClient = {
        rpc: (fn: string, params: Record<string, unknown>) => {
          rpcName = fn;
          rpcParams = params;
          return Promise.resolve({
            data: {
              id: "share-link-uuid-1",
              design_id: DESIGN_ID,
              token: params.p_raw_token,
              permission: "view",
              is_enabled: false,
              expires_at: null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            error: null,
          });
        },
      };

      // @ts-expect-error mock client
      const repo = new SupabaseShareRepository({ client: mockClient });
      const link = await repo.getOrCreateShareLink(DESIGN_ID);

      assert.equal(rpcName, "get_or_create_design_share_link");
      assert.equal(rpcParams.p_design_id, DESIGN_ID);
      assert.ok(rpcParams.p_raw_token, "Must generate high-entropy raw token");
      assert.equal(link.designId, DESIGN_ID);
      assert.equal(link.isEnabled, false);
      assert.equal(link.permission, "view");
    });
  });

  describe("updateShareLink", () => {
    test("rejects missing designId or invalid inputs", async () => {
      const mockClient = {
        rpc: () => Promise.resolve({ data: null, error: null }),
      };
      // @ts-expect-error mock client
      const repo = new SupabaseShareRepository({ client: mockClient });

      // @ts-expect-error invalid input
      await assert.rejects(() => repo.updateShareLink(null), /Missing designId/);
      // @ts-expect-error missing designId
      await assert.rejects(() => repo.updateShareLink({ isEnabled: true, permission: "view" }), /Missing designId/);
    });

    test("updates permission and enabled state via update_design_share_link RPC", async () => {
      let rpcParams: Record<string, unknown> = {};

      const mockClient = {
        rpc: (fn: string, params: Record<string, unknown>) => {
          assert.equal(fn, "update_design_share_link");
          rpcParams = params;
          return Promise.resolve({
            data: {
              id: "share-link-uuid-1",
              design_id: DESIGN_ID,
              token: "sample-token",
              permission: params.p_permission,
              is_enabled: params.p_is_enabled,
              expires_at: null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            error: null,
          });
        },
      };

      // @ts-expect-error mock client
      const repo = new SupabaseShareRepository({ client: mockClient });
      const updated = await repo.updateShareLink({
        designId: DESIGN_ID,
        isEnabled: true,
        permission: "edit",
      });

      assert.equal(rpcParams.p_design_id, DESIGN_ID);
      assert.equal(rpcParams.p_is_enabled, true);
      assert.equal(rpcParams.p_permission, "edit");
      assert.equal(rpcParams.p_regenerate_token, false);
      assert.equal(updated.isEnabled, true);
      assert.equal(updated.permission, "edit");
    });

    test("rotates token when regenerateToken is true", async () => {
      let rpcParams: Record<string, unknown> = {};

      const mockClient = {
        rpc: (_fn: string, params: Record<string, unknown>) => {
          rpcParams = params;
          return Promise.resolve({
            data: {
              id: "share-link-uuid-1",
              design_id: DESIGN_ID,
              token: params.p_new_raw_token,
              permission: "view",
              is_enabled: true,
              expires_at: null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            error: null,
          });
        },
      };

      // @ts-expect-error mock client
      const repo = new SupabaseShareRepository({ client: mockClient });
      const updated = await repo.updateShareLink({
        designId: DESIGN_ID,
        isEnabled: true,
        permission: "view",
        regenerateToken: true,
      });

      assert.equal(rpcParams.p_regenerate_token, true);
      assert.ok(rpcParams.p_new_raw_token, "Must pass new raw token for hashing and rotation");
      assert.equal(updated.token, rpcParams.p_new_raw_token);
    });
  });

  describe("getSharedDesign", () => {
    test("returns null for empty or whitespace-only token", async () => {
      const mockClient = {
        rpc: () => Promise.resolve({ data: null, error: null }),
      };
      // @ts-expect-error mock client
      const repo = new SupabaseShareRepository({ client: mockClient });

      assert.equal(await repo.getSharedDesign(""), null);
      assert.equal(await repo.getSharedDesign("   "), null);
    });

    test("returns safe design details for valid enabled token", async () => {
      const mockClient = {
        rpc: (fn: string, params: Record<string, unknown>) => {
          assert.equal(fn, "get_shared_design_by_token");
          assert.equal(params.p_raw_token, RAW_TOKEN);
          return Promise.resolve({
            data: {
              design: {
                id: DESIGN_ID,
                name: "Public Cellular Figure",
                width: 1200,
                height: 800,
                backgroundColor: "#ffffff",
                pages: [{ id: "page-1", elements: [] }],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
              permission: "view",
              share_id: "link-uuid-123",
            },
            error: null,
          });
        },
      };

      // @ts-expect-error mock client
      const repo = new SupabaseShareRepository({ client: mockClient });
      const result = await repo.getSharedDesign(RAW_TOKEN);

      assert.ok(result);
      assert.equal(result.design.id, DESIGN_ID);
      assert.equal(result.design.name, "Public Cellular Figure");
      assert.equal(result.permission, "view");
      assert.equal(result.shareId, "link-uuid-123");
      assert.equal((result.design as unknown as Record<string, unknown>).workspaceId, undefined, "Must not leak workspaceId to public recipients");
    });

    test("returns null when RPC returns null (e.g. disabled or expired)", async () => {
      const mockClient = {
        rpc: () => Promise.resolve({ data: null, error: null }),
      };
      // @ts-expect-error mock client
      const repo = new SupabaseShareRepository({ client: mockClient });
      const result = await repo.getSharedDesign("revoked-token");
      assert.equal(result, null);
    });
  });

  describe("updateSharedDesignContent", () => {
    test("rejects missing designId or token", async () => {
      const mockClient = {
        rpc: () => Promise.resolve({ data: null, error: null }),
      };
      // @ts-expect-error mock client
      const repo = new SupabaseShareRepository({ client: mockClient });

      await assert.rejects(
        () => repo.updateSharedDesignContent("", RAW_TOKEN, []),
        /Missing designId or share token/
      );
      await assert.rejects(
        () => repo.updateSharedDesignContent(DESIGN_ID, "", []),
        /Missing designId or share token/
      );
    });

    test("invokes update_shared_design_content RPC and returns updated document", async () => {
      const pages = [{ id: "page-1", elements: [{ id: "el-1", type: "shape" as const, x: 10, y: 10, width: 50, height: 50, rotation: 0, opacity: 1, properties: {} }] }];
      let rpcParams: Record<string, unknown> = {};

      const mockClient = {
        rpc: (fn: string, params: Record<string, unknown>) => {
          assert.equal(fn, "update_shared_design_content");
          rpcParams = params;
          return Promise.resolve({
            data: {
              id: DESIGN_ID,
              name: "Public Cellular Figure",
              width: 1200,
              height: 800,
              backgroundColor: "#ffffff",
              pages,
              thumbnail: "data:image/png;base64,sample",
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
            error: null,
          });
        },
      };

      // @ts-expect-error mock client
      const repo = new SupabaseShareRepository({ client: mockClient });
      const result = await repo.updateSharedDesignContent(DESIGN_ID, RAW_TOKEN, pages, "data:image/png;base64,sample");

      assert.equal(rpcParams.p_design_id, DESIGN_ID);
      assert.equal(rpcParams.p_raw_token, RAW_TOKEN);
      assert.deepEqual(rpcParams.p_pages, pages);
      assert.equal(result.id, DESIGN_ID);
      assert.deepEqual(result.pages, pages);
    });

    test("propagates permission rejection from server when link only grants view", async () => {
      const mockClient = {
        rpc: () =>
          Promise.resolve({
            data: null,
            error: { message: "Share link only grants viewing permissions; editing is forbidden" },
          }),
      };

      // @ts-expect-error mock client
      const repo = new SupabaseShareRepository({ client: mockClient });
      await assert.rejects(
        () => repo.updateSharedDesignContent(DESIGN_ID, RAW_TOKEN, []),
        /viewing permissions/
      );
    });
  });
});
