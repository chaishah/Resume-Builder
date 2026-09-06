import type { PDFPageProxy } from "pdfjs-dist";
import type { TextContent } from "pdfjs-dist/types/src/display/api";

export async function readPdfPageText(
  page: PDFPageProxy,
): Promise<TextContent> {
  // PDF.js handles XFA form text separately from the normal page stream.
  if (page.isPureXfa) return page.getTextContent();

  // Safari before 26.4 has getReader(), but no ReadableStream async iterator.
  // Even PDF.js's legacy getTextContent() currently uses for-await on that stream.
  const reader = page.streamTextContent().getReader();
  const text: TextContent = {
    items: [],
    styles: Object.create(null),
    lang: null,
  };
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) return text;
      text.lang ??= value.lang;
      Object.assign(text.styles, value.styles);
      text.items.push(...value.items);
    }
  } finally {
    reader.releaseLock();
  }
}
