import Fastify from "fastify";
import { askRoute } from "./routes/ask.ts";
import { pool } from "./db/pool.ts";

// Application setup and configuration for the Fastify server.

export function createApp() {
  const app = Fastify({
    logger: true,
    bodyLimit: 16 * 1024,
    requestTimeout: 30_000,
  });

  app.decorateRequest("user", null);

  // Liveness check endpoint to verify that the server is running.
  app.get("/health/live", async () => ({
    status: "UP",
  }));

  // Readiness check endpoint to verify database connectivity.
  app.get("/health/ready", async (_request, reply) => {
    try {
      await pool.query("SELECT 1");
      return { status: "UP" };
    } catch {
      return reply.code(503).send({
        status: "NOT_READY",
      });
    }
  });

  app.register(askRoute);

  return app;
}