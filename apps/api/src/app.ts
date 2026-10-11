import fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { config } from "./config/index.js";
import { registerRequestLogger } from "./middleware/request-logger.js";
import { healthRoutes } from "./modules/health/health.routes.js";
import { workspaceRoutes } from "./modules/workspaces/workspaces.routes.js";
import { invitationRoutes } from "./modules/workspaces/invitations.routes.js";
import { sharingRoutes } from "./modules/sharing/sharing.routes.js";

export async function buildApp(): Promise<FastifyInstance> {
  const app = fastify({
    logger: {
      level: config.env === "production" ? "info" : "debug",
    },
  });

  // Plugins
  await app.register(cors, {
    origin: config.corsOrigin,
    credentials: true,
  });

  // Middleware / hooks
  registerRequestLogger(app);

  // Routes
  await app.register(healthRoutes);
  await app.register(workspaceRoutes);
  await app.register(invitationRoutes);
  await app.register(sharingRoutes);

  return app;
}

