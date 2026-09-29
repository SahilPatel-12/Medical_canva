import { buildApp } from "./app.js";
import { config } from "./config/index.js";

async function main(): Promise<void> {
  const app = await buildApp();

  try {
    const address = await app.listen({
      host: config.host,
      port: config.port,
    });
    app.log.info(`API server successfully listening at ${address}`);
  } catch (err) {
    app.log.error(err, "Failed to start API server");
    process.exit(1);
  }
}

void main();
