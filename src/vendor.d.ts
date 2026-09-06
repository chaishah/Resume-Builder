declare module "mammoth/mammoth.browser" {
  export function extractRawText(options: {
    arrayBuffer: ArrayBufferLike;
  }): Promise<{ value: string; messages: unknown[] }>;
}
