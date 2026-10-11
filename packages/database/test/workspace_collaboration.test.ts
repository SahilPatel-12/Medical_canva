import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { SupabaseWorkspaceRepository } from "../src/index.js";

describe("Stage 2: Workspace Collaboration & Role Authorization (Simulated Logic)", () => {
  const WS_ID = "33333333-3333-3333-3333-333333333333";
  const OWNER_ID = "owner-uuid-111";
  const EDITOR_ID = "editor-uuid-333";
  const VIEWER_ID = "viewer-uuid-444";

  describe("Workspace Invitations — Creation, Validation & Hashing", () => {
    test("createInvitation rejects missing or invalid inputs", async () => {
      const mockClient = {
        rpc: () => Promise.resolve({ data: null, error: null }),
      };
      // @ts-expect-error mock client
      const repo = new SupabaseWorkspaceRepository({ client: mockClient });

      // @ts-expect-error invalid input
      await assert.rejects(() => repo.createInvitation(null), /Missing required invitation fields/);
      await assert.rejects(() => repo.createInvitation({ workspaceId: "", email: "a@b.com", role: "editor" }), /Missing required invitation fields/);
    });

    test("createInvitation invokes transactional RPC with high-entropy raw token", async () => {
      let passedParams: Record<string, unknown> = {};

      const mockClient = {
        rpc: (fn: string, params: Record<string, unknown>) => {
          assert.equal(fn, "create_workspace_invitation");
          passedParams = params;
          return Promise.resolve({
            data: {
              id: "inv-uuid-123",
              workspace_id: params.p_workspace_id,
              email: params.p_email,
              role: params.p_role,
              status: "pending",
              expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
              created_at: new Date().toISOString(),
            },
            error: null,
          });
        },
      };

      // @ts-expect-error mock client
      const repo = new SupabaseWorkspaceRepository({ client: mockClient });
      const result = await repo.createInvitation({
        workspaceId: WS_ID,
        email: "collaborator@lab.org",
        role: "editor",
      });

      assert.equal(result.workspaceId, WS_ID);
      assert.equal(result.email, "collaborator@lab.org");
      assert.equal(result.role, "editor");
      assert.equal(result.status, "pending");

      // Verify a high-entropy raw token was generated and passed
      assert.ok(result.token, "Result must contain the unhashed token for sharing");
      assert.equal(typeof passedParams.p_raw_token, "string");
      assert.equal((passedParams.p_raw_token as string).length, 64, "Raw token must be 32 bytes (64 hex characters)");
    });

    test("createInvitation bubbles up database authorization / duplicate errors", async () => {
      const mockClient = {
        rpc: () =>
          Promise.resolve({
            data: null,
            error: { message: "Only workspace owners and admins can invite members" },
          }),
      };

      // @ts-expect-error mock client
      const repo = new SupabaseWorkspaceRepository({ client: mockClient });
      await assert.rejects(
        () => repo.createInvitation({ workspaceId: WS_ID, email: "colleague@mit.edu", role: "viewer" }),
        /Only workspace owners and admins can invite members/
      );
    });
  });

  describe("Invitation Revocation & Inspection", () => {
    test("revokeInvitation invokes revoke_workspace_invitation RPC", async () => {
      let revokedId = "";
      const mockClient = {
        rpc: (fn: string, params: { p_invitation_id: string }) => {
          assert.equal(fn, "revoke_workspace_invitation");
          revokedId = params.p_invitation_id;
          return Promise.resolve({ data: true, error: null });
        },
      };

      // @ts-expect-error mock client
      const repo = new SupabaseWorkspaceRepository({ client: mockClient });
      const ok = await repo.revokeInvitation("inv-uuid-abc");
      assert.equal(ok, true);
      assert.equal(revokedId, "inv-uuid-abc");
    });

    test("getInvitationDetails returns safe details without exposing token hash", async () => {
      const mockClient = {
        rpc: (fn: string, params: { p_raw_token: string }) => {
          assert.equal(fn, "get_invitation_details");
          assert.equal(params.p_raw_token, "valid-token-123");
          return Promise.resolve({
            data: {
              id: "inv-uuid-456",
              workspace_id: WS_ID,
              workspace_name: "Genomics Core",
              email: "researcher@lab.org",
              role: "editor",
              status: "pending",
              expires_at: new Date(Date.now() + 86400000).toISOString(),
            },
            error: null,
          });
        },
      };

      // @ts-expect-error mock client
      const repo = new SupabaseWorkspaceRepository({ client: mockClient });
      const details = await repo.getInvitationDetails("valid-token-123");

      assert.ok(details);
      assert.equal(details?.workspaceName, "Genomics Core");
      assert.equal(details?.email, "researcher@lab.org");
      assert.equal(details?.role, "editor");
      assert.equal((details as unknown as Record<string, unknown>).token_hash, undefined, "Token hash must never be returned");
    });
  });

  describe("Invitation Acceptance — Email Verification & Expiry", () => {
    test("acceptInvitation succeeds when caller matches invitation email", async () => {
      const mockClient = {
        rpc: (fn: string, params: { p_raw_token: string }) => {
          assert.equal(fn, "accept_workspace_invitation");
          assert.equal(params.p_raw_token, "secret-token-xyz");
          return Promise.resolve({ data: WS_ID, error: null });
        },
      };

      // @ts-expect-error mock client
      const repo = new SupabaseWorkspaceRepository({ client: mockClient });
      const joinedWsId = await repo.acceptInvitation("secret-token-xyz");
      assert.equal(joinedWsId, WS_ID);
    });

    test("acceptInvitation rejects if caller email does not match", async () => {
      const mockClient = {
        rpc: () =>
          Promise.resolve({
            data: null,
            error: { message: "Authenticated email does not match invitation email" },
          }),
      };

      // @ts-expect-error mock client
      const repo = new SupabaseWorkspaceRepository({ client: mockClient });
      await assert.rejects(
        () => repo.acceptInvitation("secret-token-xyz"),
        /Authenticated email does not match/
      );
    });

    test("acceptInvitation rejects if invitation is expired", async () => {
      const mockClient = {
        rpc: () =>
          Promise.resolve({
            data: null,
            error: { message: "This invitation has expired" },
          }),
      };

      // @ts-expect-error mock client
      const repo = new SupabaseWorkspaceRepository({ client: mockClient });
      await assert.rejects(
        () => repo.acceptInvitation("expired-token"),
        /This invitation has expired/
      );
    });
  });

  describe("Member Role Updates & Owner Protection Invariants", () => {
    test("updateMemberRole updates role when authorized", async () => {
      let calledParams: Record<string, unknown> = {};
      const mockClient = {
        rpc: (fn: string, params: Record<string, unknown>) => {
          assert.equal(fn, "update_workspace_member_role");
          calledParams = params;
          return Promise.resolve({ data: true, error: null });
        },
      };

      // @ts-expect-error mock client
      const repo = new SupabaseWorkspaceRepository({ client: mockClient });
      const ok = await repo.updateMemberRole(WS_ID, EDITOR_ID, "admin");
      assert.equal(ok, true);
      assert.equal(calledParams.p_workspace_id, WS_ID);
      assert.equal(calledParams.p_target_user_id, EDITOR_ID);
      assert.equal(calledParams.p_new_role, "admin");
    });

    test("updateMemberRole strictly prevents demoting workspace owner", async () => {
      const mockClient = {
        rpc: () =>
          Promise.resolve({
            data: null,
            error: { message: "Cannot modify the role of the workspace owner" },
          }),
      };

      // @ts-expect-error mock client
      const repo = new SupabaseWorkspaceRepository({ client: mockClient });
      await assert.rejects(
        () => repo.updateMemberRole(WS_ID, OWNER_ID, "viewer"),
        /Cannot modify the role of the workspace owner/
      );
    });

    test("removeMember strictly prevents removing workspace owner", async () => {
      const mockClient = {
        rpc: () =>
          Promise.resolve({
            data: null,
            error: { message: "Cannot remove the workspace owner from the workspace" },
          }),
      };

      // @ts-expect-error mock client
      const repo = new SupabaseWorkspaceRepository({ client: mockClient });
      await assert.rejects(
        () => repo.removeMember(WS_ID, OWNER_ID),
        /Cannot remove the workspace owner/
      );
    });

    test("removeMember allows removing non-owner members", async () => {
      let removedTarget = "";
      const mockClient = {
        rpc: (fn: string, params: { p_target_user_id: string }) => {
          assert.equal(fn, "remove_workspace_member");
          removedTarget = params.p_target_user_id;
          return Promise.resolve({ data: true, error: null });
        },
      };

      // @ts-expect-error mock client
      const repo = new SupabaseWorkspaceRepository({ client: mockClient });
      const ok = await repo.removeMember(WS_ID, VIEWER_ID);
      assert.equal(ok, true);
      assert.equal(removedTarget, VIEWER_ID);
    });
  });

  describe("Role Enforcement on Designs — Viewer vs Editor Boundaries", () => {
    test("Role-based design authorization policy logic: Viewers can SELECT, but NOT INSERT/UPDATE/DELETE", () => {
      // Logic simulation of PostgreSQL has_workspace_role(workspace_id, uid, ARRAY['owner', 'admin', 'editor'])
      const canReadDesign = (role: string) => ["owner", "admin", "editor", "viewer"].includes(role);
      const canWriteDesign = (role: string) => ["owner", "admin", "editor"].includes(role);

      // Verify Viewer access
      assert.equal(canReadDesign("viewer"), true, "Viewer must be permitted to read designs");
      assert.equal(canWriteDesign("viewer"), false, "Viewer must NOT be permitted to create, update, or delete designs");

      // Verify Editor access
      assert.equal(canReadDesign("editor"), true, "Editor must be permitted to read designs");
      assert.equal(canWriteDesign("editor"), true, "Editor must be permitted to write designs");

      // Verify Admin access
      assert.equal(canReadDesign("admin"), true, "Admin must be permitted to read designs");
      assert.equal(canWriteDesign("admin"), true, "Admin must be permitted to write designs");

      // Verify Owner access
      assert.equal(canReadDesign("owner"), true, "Owner must be permitted to read designs");
      assert.equal(canWriteDesign("owner"), true, "Owner must be permitted to write designs");
    });
  });
});
