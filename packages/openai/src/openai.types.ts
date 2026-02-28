export interface OpenAIConnectorConfig {
  apiKey: string;
  baseURL?: string | undefined;
  timeout?: number | undefined;
  /** Allow usage in browser environments (dev only — exposes API key to client). */
  dangerouslyAllowBrowser?: boolean | undefined;
}
