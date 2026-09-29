import type { FastifyInstance } from "fastify";

export function registerRequestLogger(fastify: FastifyInstance): void {
  fastify.addHook("onRequest", async (request) => {
    request.log.info({ url: request.url, method: request.method }, "Incoming request");
  });

  fastify.addHook("onResponse", async (request, reply) => {
    request.log.info(
      {
        url: request.url,
        statusCode: reply.statusCode,
        responseTimeMs: reply.elapsedTime,
      },
      "Request completed"
    );
  });
}
