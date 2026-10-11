import type { FastifyPluginAsync } from "fastify";
import { SupabaseWorkspaceRepository, createUserScopedClient } from "@design-platform/database";
import { authenticateUser } from "../../middleware/auth.js";

export const invitationRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /invitations/:token
   * Public lookup for invitation details before acceptance.
   * Does not require authentication so invitee can view workspace details.
   */
  fastify.get<{ Params: { token: string } }>("/invitations/:token", async (request, reply) => {
    const { token } = request.params;

    if (!token || token.trim().length === 0) {
      return reply.status(400).send({ error: "Missing invitation token" });
    }

    try {
      // Use client without auth token for safe public RPC
      const client = createUserScopedClient();
      const repo = new SupabaseWorkspaceRepository({ client });

      const details = await repo.getInvitationDetails(token.trim());
      if (!details) {
        return reply.status(404).send({ error: "Invitation not found or has been revoked" });
      }

      return reply.status(200).send({ invitation: details });
    } catch (err) {
      request.log.error({ err }, "Error retrieving invitation details");
      return reply.status(500).send({ error: "Internal server error" });
    }
  });

  /**
   * POST /invitations/accept
   * Accepts a workspace invitation. Requires authentication.
   */
  fastify.post<{ Body: { token: string } }>(
    "/invitations/accept",
    { preHandler: [authenticateUser] },
    async (request, reply) => {
      const { token } = request.body || {};

      if (!token || token.trim().length === 0) {
        return reply.status(400).send({ error: "Missing invitation token" });
      }

      try {
        const client = createUserScopedClient(request.authToken);
        const repo = new SupabaseWorkspaceRepository({ client });

        const workspaceId = await repo.acceptInvitation(token.trim());
        return reply.status(200).send({ success: true, workspaceId });
      } catch (err) {
        const message = (err as Error).message;
        request.log.warn({ err }, "Failed to accept invitation");

        if (message.includes("expired")) {
          return reply.status(410).send({ error: message });
        }
        if (message.includes("email does not match")) {
          return reply.status(403).send({ error: message });
        }
        return reply.status(400).send({ error: message || "Failed to accept invitation" });
      }
    }
  );
};
