import { config } from "./config/index.js";

async function runWorker(): Promise<void> {
  console.log(`[Worker] Design Platform Worker initialized in ${config.env} mode`);
  console.log(`[Worker] Concurrency set to ${config.concurrency}`);
  console.log("[Worker] Waiting for background jobs... (worker running)");

  const shutdown = (signal: string) => {
    console.log(`[Worker] Received ${signal}. Shutting down worker gracefully...`);
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  // Keep worker process alive
  setInterval(() => {
    // Heartbeat / health check pulse
  }, 60000);
}

void runWorker();
