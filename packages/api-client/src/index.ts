import type { ApiResponse, HealthStatus } from "@design-platform/types";

export interface ApiClientConfig {
  baseUrl: string;
  timeoutMs?: number;
  headers?: Record<string, string>;
}

export class ApiClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly defaultHeaders: Record<string, string>;

  constructor(config: ApiClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.timeoutMs = config.timeoutMs ?? 10000;
    this.defaultHeaders = {
      "Content-Type": "application/json",
      ...(config.headers ?? {}),
    };
  }

  public async getHealth(): Promise<ApiResponse<HealthStatus>> {
    const response = await fetch(`${this.baseUrl}/health`, {
      method: "GET",
      headers: this.defaultHeaders,
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    if (!response.ok) {
      throw new Error(`Health check failed with status: ${response.status}`);
    }

    return (await response.json()) as ApiResponse<HealthStatus>;
  }
}

export function createApiClient(config: ApiClientConfig): ApiClient {
  return new ApiClient(config);
}
