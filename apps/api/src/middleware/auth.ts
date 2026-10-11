import type { FastifyRequest, FastifyReply } from "fastify";
import { verifySupabaseToken, type AuthUser } from "@design-platform/auth";

declare module "fastify" {
  interface FastifyRequest {
    user?: AuthUser;
    authToken?: string;
  }
}

/**
 * Fastify preHandler hook to verify Supabase JWT in Authorization header.
 * Usage:
 *   fastify.get('/protected', { preHandler: [authenticateUser] }, async (req, reply) => { ... });
 */
export async function authenticateUser(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const authHeader = request.headers.authorization;
  if (!authHeader) {
    reply.status(401).send({ error: "Missing Authorization header" });
    return;
  }

  const { user, error } = await verifySupabaseToken(authHeader);
  if (error || !user) {
    reply.status(401).send({ error: error || "Unauthorized" });
    return;
  }

  request.user = user;
  request.authToken = authHeader.replace(/^Bearer\s+/i, "").trim();
}
