export interface WorkerConfig {
  env: string;
  concurrency: number;
}

export const config: WorkerConfig = {
  env: process.env.NODE_ENV ?? "development",
  concurrency: parseInt(process.env.WORKER_CONCURRENCY ?? "5", 10),
};
