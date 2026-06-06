import { loadConfig } from "./config.js";
import { createSlackApp } from "./slackApp.js";
import { logger } from "./logger.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const app = createSlackApp(config);

  await app.start();
  logger.info("colombo started", {
    codexWorkdir: config.codexWorkdir,
    colomboDir: config.colomboDir,
    maxConcurrentJobs: config.maxConcurrentJobs,
    maxQueueSize: config.maxQueueSize
  });
}

main().catch((error: unknown) => {
  logger.error("colombo failed to start", { error: String(error) });
  process.exitCode = 1;
});
