import type { FastifyPluginAsync } from "fastify";
import { SupabaseWorkspaceRepository, createUserScopedClient } from "@design-platform/database";
import { authenticateUser } from "../../middleware/auth.js";

function isValidUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

export const workspaceRoutes: FastifyPluginAsync = async (fastify) => {
  // All workspace routes require an authenticated user
  fastify.addHook("preHandler", authenticateUser);

  /**
   * GET /workspaces
   * Returns all workspaces the caller is a member of.
   */
  fastify.get("/workspaces", async (request, reply) => {
    try {
      const client = createUserScopedClient(request.authToken);
      const repo = new SupabaseWorkspaceRepository({ client });
      const workspaces = await repo.listMyWorkspaces();

      return reply.status(200).send({ workspaces });
    } catch (err) {
      request.log.error({ err }, "Error listing workspaces");
      return reply.status(500).send({ error: "Internal server error" });
    }
  });

  /**
   * GET /workspaces/:workspaceId
   * Returns a specific workspace if the caller is a member.
   */
  fastify.get<{ Params: { workspaceId: string } }>("/workspaces/:workspaceId", async (request, reply) => {
    const { workspaceId } = request.params;

    if (!isValidUuid(workspaceId)) {
      return reply.status(400).send({ error: "Invalid workspace ID format" });
    }

    try {
      const client = createUserScopedClient(request.authToken);
      const repo = new SupabaseWorkspaceRepository({ client });

      const workspace = await repo.getWorkspaceById(workspaceId);
      if (!workspace) {
        return reply.status(404).send({ error: "Workspace not found" });
      }

      const membership = await repo.getMyMembership(workspaceId);

      return reply.status(200).send({
        workspace,
        role: membership?.role || null,
      });
    } catch (err) {
      request.log.error({ err, workspaceId }, "Error retrieving workspace");
      return reply.status(500).send({ error: "Internal server error" });
    }
  });

  /**
   * GET /workspaces/:workspaceId/membership
   * Returns caller's membership details for a given workspace.
   */
  fastify.get<{ Params: { workspaceId: string } }>("/workspaces/:workspaceId/membership", async (request, reply) => {
    const { workspaceId } = request.params;

    if (!isValidUuid(workspaceId)) {
      return reply.status(400).send({ error: "Invalid workspace ID format" });
    }

    try {
      const client = createUserScopedClient(request.authToken);
      const repo = new SupabaseWorkspaceRepository({ client });

      const membership = await repo.getMyMembership(workspaceId);
      if (!membership) {
        return reply.status(404).send({ error: "Membership not found in this workspace" });
      }

      return reply.status(200).send({ membership });
    } catch (err) {
      request.log.error({ err, workspaceId }, "Error retrieving membership");
      return reply.status(500).send({ error: "Internal server error" });
    }
  });

  /**
   * GET /workspaces/:workspaceId/members
   * Returns list of members in the workspace.
   */
  fastify.get<{ Params: { workspaceId: string } }>("/workspaces/:workspaceId/members", async (request, reply) => {
    const { workspaceId } = request.params;

    if (!isValidUuid(workspaceId)) {
      return reply.status(400).send({ error: "Invalid workspace ID format" });
    }

    try {
      const client = createUserScopedClient(request.authToken);
      const repo = new SupabaseWorkspaceRepository({ client });

      const members = await repo.getWorkspaceMembers(workspaceId);
      return reply.status(200).send({ members });
    } catch (err) {
      request.log.error({ err, workspaceId }, "Error retrieving workspace members");
      return reply.status(500).send({ error: "Internal server error" });
    }
  });

  /**
   * PATCH /workspaces/:workspaceId/members/:userId
   * Updates an existing member's role.
   */
  fastify.patch<{
    Params: { workspaceId: string; userId: string };
    Body: { role: "admin" | "editor" | "viewer" };
  }>("/workspaces/:workspaceId/members/:userId", async (request, reply) => {
    const { workspaceId, userId } = request.params;
    const { role } = request.body || {};

    if (!isValidUuid(workspaceId) || !isValidUuid(userId)) {
      return reply.status(400).send({ error: "Invalid UUID format" });
    }

    if (!role || !["admin", "editor", "viewer"].includes(role)) {
      return reply.status(400).send({ error: "Invalid role. Must be admin, editor, or viewer" });
    }

    try {
      const client = createUserScopedClient(request.authToken);
      const repo = new SupabaseWorkspaceRepository({ client });

      await repo.updateMemberRole(workspaceId, userId, role);
      return reply.status(200).send({ success: true });
    } catch (err) {
      const message = (err as Error).message;
      request.log.warn({ err, workspaceId, userId }, "Failed to update member role");
      if (message.includes("Cannot modify the role of the workspace owner")) {
        return reply.status(403).send({ error: message });
      }
      if (message.includes("Only workspace owners and admins")) {
        return reply.status(403).send({ error: message });
      }
      return reply.status(400).send({ error: message || "Failed to update member role" });
    }
  });

  /**
   * DELETE /workspaces/:workspaceId/members/:userId
   * Removes a member from the workspace (or leave).
   */
  fastify.delete<{ Params: { workspaceId: string; userId: string } }>(
    "/workspaces/:workspaceId/members/:userId",
    async (request, reply) => {
      const { workspaceId, userId } = request.params;

      if (!isValidUuid(workspaceId) || !isValidUuid(userId)) {
        return reply.status(400).send({ error: "Invalid UUID format" });
      }

      try {
        const client = createUserScopedClient(request.authToken);
        const repo = new SupabaseWorkspaceRepository({ client });

        await repo.removeMember(workspaceId, userId);
        return reply.status(200).send({ success: true });
      } catch (err) {
        const message = (err as Error).message;
        request.log.warn({ err, workspaceId, userId }, "Failed to remove member");
        if (message.includes("Cannot remove the workspace owner")) {
          return reply.status(403).send({ error: message });
        }
        if (message.includes("Only workspace owners and admins")) {
          return reply.status(403).send({ error: message });
        }
        return reply.status(400).send({ error: message || "Failed to remove member" });
      }
    }
  );

  /**
   * GET /workspaces/:workspaceId/invitations
   * Lists invitations for a workspace.
   */
  fastify.get<{ Params: { workspaceId: string } }>("/workspaces/:workspaceId/invitations", async (request, reply) => {
    const { workspaceId } = request.params;

    if (!isValidUuid(workspaceId)) {
      return reply.status(400).send({ error: "Invalid workspace ID format" });
    }

    try {
      const client = createUserScopedClient(request.authToken);
      const repo = new SupabaseWorkspaceRepository({ client });

      const invitations = await repo.listInvitations(workspaceId);
      return reply.status(200).send({ invitations });
    } catch (err) {
      request.log.error({ err, workspaceId }, "Error listing invitations");
      return reply.status(500).send({ error: "Internal server error" });
    }
  });

  /**
   * POST /workspaces/:workspaceId/invitations
   * Creates a new workspace invitation.
   */
  fastify.post<{
    Params: { workspaceId: string };
    Body: { email: string; role: "admin" | "editor" | "viewer" };
  }>("/workspaces/:workspaceId/invitations", async (request, reply) => {
    const { workspaceId } = request.params;
    const { email, role } = request.body || {};

    if (!isValidUuid(workspaceId)) {
      return reply.status(400).send({ error: "Invalid workspace ID format" });
    }

    if (!email || !email.includes("@")) {
      return reply.status(400).send({ error: "Invalid or missing email address" });
    }

    if (!role || !["admin", "editor", "viewer"].includes(role)) {
      return reply.status(400).send({ error: "Invalid role. Must be admin, editor, or viewer" });
    }

    try {
      const client = createUserScopedClient(request.authToken);
      const repo = new SupabaseWorkspaceRepository({ client });

      const invitation = await repo.createInvitation({
        workspaceId,
        email,
        role,
      });

      return reply.status(201).send({ invitation });
    } catch (err) {
      const message = (err as Error).message;
      request.log.warn({ err, workspaceId, email }, "Failed to create invitation");
      if (message.includes("Only workspace owners and admins")) {
        return reply.status(403).send({ error: message });
      }
      return reply.status(400).send({ error: message || "Failed to create invitation" });
    }
  });

  /**
   * DELETE /workspaces/:workspaceId/invitations/:invitationId
   * Revokes a pending invitation.
   */
  fastify.delete<{
    Params: { workspaceId: string; invitationId: string };
  }>("/workspaces/:workspaceId/invitations/:invitationId", async (request, reply) => {
    const { workspaceId, invitationId } = request.params;

    if (!isValidUuid(workspaceId) || !isValidUuid(invitationId)) {
      return reply.status(400).send({ error: "Invalid UUID format" });
    }

    try {
      const client = createUserScopedClient(request.authToken);
      const repo = new SupabaseWorkspaceRepository({ client });

      await repo.revokeInvitation(invitationId);
      return reply.status(200).send({ success: true });
    } catch (err) {
      const message = (err as Error).message;
      request.log.warn({ err, workspaceId, invitationId }, "Failed to revoke invitation");
      if (message.includes("Only workspace owners and admins")) {
        return reply.status(403).send({ error: message });
      }
      return reply.status(400).send({ error: message || "Failed to revoke invitation" });
    }
  });
};
