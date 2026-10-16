import "dotenv/config";
import { createApp } from "./app.js";
import { pool } from "./db/pool.js";

// request.user is not populated automatically. Wire an approved OIDC/JWT authentication into Fastify before handling routes. 
// In addition to the signature, verify at least the issuer, audience, expiration time and required roles. 
// Derive tenantId from the verified identity and the server's access rules.
// This is a deliberate limit: the API above is not production-ready until authentication, authorization, rate limiting 
// and data source filtering have been tested.
// In addition, requestTimeout alone does not guarantee that an in-progress model service request is cancelled. 
// Also set timeouts for model calls and implement cancellation where necessary.

// Entry point for the knowledge assistant server.

const app = createApp();
const port = Number(process.env.PORT ?? 8080);

// Start the server and handle graceful shutdown.

async function start() {
  try {
    await pool.query("SELECT 1");

    await app.listen({
      host: "0.0.0.0",
      port,
    });

    app.log.info("Tietoassistentti käynnistyi");
  } catch (error) {
    app.log.error({ err: error }, "Käynnistys epäonnistui");
    await pool.end();
    process.exitCode = 1;
  }
}

// Handle graceful shutdown on termination signals.

async function shutdown() {
  await app.close();
  await pool.end();
}

// Listen for termination signals to initiate graceful shutdown.

process.once("SIGTERM", () => {
  void shutdown().catch((error) => {
    app.log.error({ err: error }, "Sammutuksessa virhe");
    process.exitCode = 1;
  });
});

// Listen for SIGINT (Ctrl+C) to initiate graceful shutdown.

process.once("SIGINT", () => {
  void shutdown().catch((error) => {
    app.log.error({ err: error }, "Sammutuksessa virhe");
    process.exitCode = 1;
  });
});

void start();