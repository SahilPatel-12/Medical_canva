export interface AppConfig {
  env: string;
  host: string;
  port: number;
  corsOrigin: string;
}

export const config: AppConfig = {
  env: process.env.NODE_ENV ?? "development",
  host: process.env.API_HOST ?? "0.0.0.0",
  port: parseInt(process.env.API_PORT ?? process.env.PORT ?? "4000", 10),
  corsOrigin: process.env.CORS_ORIGIN ?? "*",
};
