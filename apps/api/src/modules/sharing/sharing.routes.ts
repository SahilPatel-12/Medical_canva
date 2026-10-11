import type { FastifyPluginAsync } from "fastify";
import {
  SupabaseShareRepository,
  createUserScopedClient,
} from "@design-platform/database";
import type { Page, SharePermission } from "@design-platform/types";
import { authenticateUser } from "../../middleware/auth.js";

export const sharingRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /share/:token
   * Public lookup for shared design details.
   * Can be accessed anonymously; returns 404 if link is invalid, disabled, or expired.
   */
  fastify.get<{ Params: { token: string } }>("/share/:token", async (request, reply) => {
    const { token } = request.params;

    if (!token || token.trim().length === 0) {
      return reply.status(400).send({ error: "Missing share token" });
    }

    try {
      const client = createUserScopedClient();
      const repo = new SupabaseShareRepository({ client });

      const details = await repo.getSharedDesign(token.trim());
      if (!details) {
        return reply.status(404).send({ error: "Share link not found, disabled, or expired" });
      }

      return reply.status(200).send({ shared: details });
    } catch (err) {
      request.log.error({ err }, "Error retrieving shared design details");
      return reply.status(500).send({ error: "Internal server error" });
    }
  });

  /**
   * POST /share/:token/update
   * Authenticated update for shared design content.
   * Enforces that the caller is authenticated and that the link possesses active 'edit' permissions.
   */
  fastify.post<{
    Params: { token: string };
    Body: { designId: string; pages: Page[]; thumbnail?: string };
  }>(
    "/share/:token/update",
    { preHandler: [authenticateUser] },
    async (request, reply) => {
      const { token } = request.params;
      const { designId, pages, thumbnail } = request.body || {};

      if (!token || token.trim().length === 0) {
        return reply.status(400).send({ error: "Missing share token" });
      }

      if (!designId || !Array.isArray(pages)) {
        return reply.status(400).send({ error: "Missing designId or pages content" });
      }

      try {
        const client = createUserScopedClient(request.authToken);
        const repo = new SupabaseShareRepository({ client });

        const updated = await repo.updateSharedDesignContent(
          designId,
          token.trim(),
          pages,
          thumbnail
        );

        return reply.status(200).send({ design: updated });
      } catch (err) {
        const message = (err as Error).message;
        request.log.warn({ err }, "Failed to update shared design");

        if (message.includes("viewing permissions") || message.includes("forbidden")) {
          return reply.status(403).send({ error: message });
        }
        if (message.includes("expired") || message.includes("disabled") || message.includes("not found")) {
          return reply.status(404).send({ error: message });
        }
        return reply.status(400).send({ error: message || "Failed to update shared design" });
      }
    }
  );

  /**
   * GET /designs/:id/share
   * Retrieves or initializes share link configuration for a design.
   * Requires caller to have owner, admin, or editor permissions in the design workspace.
   */
  fastify.get<{ Params: { id: string } }>(
    "/designs/:id/share",
    { preHandler: [authenticateUser] },
    async (request, reply) => {
      const { id } = request.params;

      if (!id || id.trim().length === 0) {
        return reply.status(400).send({ error: "Missing design ID" });
      }

      try {
        const client = createUserScopedClient(request.authToken);
        const repo = new SupabaseShareRepository({ client });

        const link = await repo.getOrCreateShareLink(id);
        return reply.status(200).send({ shareLink: link });
      } catch (err) {
        const message = (err as Error).message;
        request.log.warn({ err }, "Failed to get share link configuration");

        if (message.includes("denied") || message.includes("Only workspace")) {
          return reply.status(403).send({ error: message });
        }
        if (message.includes("not found")) {
          return reply.status(404).send({ error: message });
        }
        return reply.status(500).send({ error: message || "Internal server error" });
      }
    }
  );

  /**
   * POST /designs/:id/share
   * Updates share link configuration (toggle isEnabled, change permission, rotate token).
   * Requires caller to have owner, admin, or editor permissions in the design workspace.
   */
  fastify.post<{
    Params: { id: string };
    Body: { isEnabled: boolean; permission: SharePermission; regenerateToken?: boolean };
  }>(
    "/designs/:id/share",
    { preHandler: [authenticateUser] },
    async (request, reply) => {
      const { id } = request.params;
      const { isEnabled, permission, regenerateToken } = request.body || {};

      if (!id || typeof isEnabled !== "boolean" || !permission) {
        return reply.status(400).send({ error: "Invalid share link update payload" });
      }

      if (permission !== "view" && permission !== "edit") {
        return reply.status(400).send({ error: "Permission must be view or edit" });
      }

      try {
        const client = createUserScopedClient(request.authToken);
        const repo = new SupabaseShareRepository({ client });

        const updated = await repo.updateShareLink({
          designId: id,
          isEnabled,
          permission,
          regenerateToken: Boolean(regenerateToken),
        });

        return reply.status(200).send({ shareLink: updated });
      } catch (err) {
        const message = (err as Error).message;
        request.log.warn({ err }, "Failed to update share link");

        if (message.includes("denied") || message.includes("Only workspace")) {
          return reply.status(403).send({ error: message });
        }
        return reply.status(400).send({ error: message || "Failed to update share link" });
      }
    }
  );
};
