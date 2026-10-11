import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { SupabaseWorkspaceRepository } from "../src/index.js";
import type {
  Workspace,
  WorkspaceRole,
  WorkspaceType,
} from "@design-platform/types";

describe("SupabaseWorkspaceRepository", () => {
  const dummyMockClient = {
    from: () => ({
      select: () => Promise.resolve({ data: [], error: null }),
    }),
    rpc: () => Promise.resolve({ data: null, error: null }),
  };

  describe("Validation & Guardrails", () => {
    test("rejects ensurePersonalWorkspace with missing user", async () => {
      // @ts-expect-error injecting mock client
      const repo = new SupabaseWorkspaceRepository({ client: dummyMockClient });

      await assert.rejects(
        // @ts-expect-error testing runtime validation
        () => repo.ensurePersonalWorkspace(null),
        /User must be provided/
      );
    });

    test("returns null from getWorkspaceById when workspaceId is empty", async () => {
      // @ts-expect-error injecting mock client
      const repo = new SupabaseWorkspaceRepository({ client: dummyMockClient });
      const res = await repo.getWorkspaceById("");
      assert.equal(res, null);
    });

    test("returns null from getMyMembership when workspaceId is empty", async () => {
      // @ts-expect-error injecting mock client
      const repo = new SupabaseWorkspaceRepository({ client: dummyMockClient });
      const res = await repo.getMyMembership("");
      assert.equal(res, null);
    });

    test("rejects createTeamWorkspace with empty name", async () => {
      // @ts-expect-error injecting mock client
      const repo = new SupabaseWorkspaceRepository({ client: dummyMockClient });

      await assert.rejects(
        () => repo.createTeamWorkspace({ name: "   " }),
        /Workspace name cannot be empty/
      );
    });
  });

  describe("Type Invariants & Role Domain Constraints", () => {
    test("supported roles match design specification", () => {
      const supportedRoles: WorkspaceRole[] = ["owner", "admin", "editor", "viewer"];
      assert.equal(supportedRoles.length, 4);
      assert.ok(supportedRoles.includes("owner"));
      assert.ok(supportedRoles.includes("admin"));
      assert.ok(supportedRoles.includes("editor"));
      assert.ok(supportedRoles.includes("viewer"));
    });

    test("supported workspace types match design specification", () => {
      const supportedTypes: WorkspaceType[] = ["personal", "team"];
      assert.equal(supportedTypes.length, 2);
      assert.ok(supportedTypes.includes("personal"));
      assert.ok(supportedTypes.includes("team"));
    });
  });

  describe("Repository Transformation Logic", () => {
    test("transforms workspace with membership into WorkspaceWithRole", async () => {
      const mockWorkspace: Workspace = {
        id: "11111111-1111-1111-1111-111111111111",
        name: "Personal Workspace",
        slug: null,
        type: "personal",
        createdBy: "user-123",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const mockClient = {
        from: (table: string) => {
          assert.equal(table, "workspace_members");
          return {
            select: () =>
              Promise.resolve({
                data: [
                  {
                    role: "owner",
                    workspaces: {
                      id: mockWorkspace.id,
                      name: mockWorkspace.name,
                      slug: mockWorkspace.slug,
                      type: mockWorkspace.type,
                      created_by: mockWorkspace.createdBy,
                      created_at: mockWorkspace.createdAt,
                      updated_at: mockWorkspace.updatedAt,
                    },
                  },
                ],
                error: null,
              }),
          };
        },
      };

      // @ts-expect-error injecting mock client
      const repo = new SupabaseWorkspaceRepository({ client: mockClient });
      const workspaces = await repo.listMyWorkspaces();

      assert.equal(workspaces.length, 1);
      assert.equal(workspaces[0]!.id, mockWorkspace.id);
      assert.equal(workspaces[0]!.name, "Personal Workspace");
      assert.equal(workspaces[0]!.role, "owner");
      assert.equal(workspaces[0]!.type, "personal");
    });

    test("handles null or empty listMyWorkspaces gracefully", async () => {
      const mockClient = {
        from: () => ({
          select: () => Promise.resolve({ data: null, error: null }),
        }),
      };

      // @ts-expect-error injecting mock client
      const repo = new SupabaseWorkspaceRepository({ client: mockClient });
      const workspaces = await repo.listMyWorkspaces();
      assert.deepEqual(workspaces, []);
    });

    test("gracefully returns empty array on Supabase query errors", async () => {
      const mockClient = {
        from: () => ({
          select: () =>
            Promise.resolve({
              data: null,
              error: { message: "Database connection failed" },
            }),
        }),
      };

      // @ts-expect-error injecting mock client
      const repo = new SupabaseWorkspaceRepository({ client: mockClient });
      const res = await repo.listMyWorkspaces();
      assert.deepEqual(res, []);
    });

    test("invokes provision_personal_workspace RPC atomically", async () => {
      let rpcNameCalled = "";
      let rpcParamsCalled: unknown = null;

      const mockClient = {
        rpc: (name: string, params: unknown) => {
          rpcNameCalled = name;
          rpcParamsCalled = params;
          return Promise.resolve({
            data: "22222222-2222-2222-2222-222222222222",
            error: null,
          });
        },
        from: (table: string) => {
          if (table === "workspace_members") {
            return {
              select: () => Promise.resolve({ data: [], error: null }),
            };
          }
          assert.equal(table, "workspaces");
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: () =>
                  Promise.resolve({
                    data: {
                      id: "22222222-2222-2222-2222-222222222222",
                      name: "Dr. Alice's Workspace",
                      slug: null,
                      type: "personal",
                      created_by: "user-alice",
                      created_at: new Date().toISOString(),
                      updated_at: new Date().toISOString(),
                    },
                    error: null,
                  }),
              }),
            }),
          };
        },
      };

      // @ts-expect-error injecting mock client
      const repo = new SupabaseWorkspaceRepository({ client: mockClient });
      const ws = await repo.ensurePersonalWorkspace({
        id: "user-alice",
        displayName: "Dr. Alice",
      });

      assert.equal(rpcNameCalled, "provision_personal_workspace");
      assert.deepEqual(rpcParamsCalled, {
        target_user_id: "user-alice",
        workspace_name: "Dr. Alice's Workspace",
      });
      assert.equal(ws.id, "22222222-2222-2222-2222-222222222222");
      assert.equal(ws.name, "Dr. Alice's Workspace");
      assert.equal(ws.role, "owner");
    });
  });
});
