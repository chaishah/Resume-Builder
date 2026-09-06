declare module "mammoth/mammoth.browser" {
  export function extractRawText(options: {
    arrayBuffer: ArrayBufferLike;
  }): Promise<{ value: string; messages: unknown[] }>;
}

declare const __APP_BUILD__: string;
