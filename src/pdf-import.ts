import { pdfjs, pdfOptions } from "./pdfjs";
import type { Extracted } from "./importer";
export async function extractPDF(
  file: File,
  progress: (s: string) => void,
  signal: AbortSignal,
): Promise<Extracted> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!new TextDecoder().decode(bytes.slice(0, 1024)).includes("%PDF-"))
    throw new Error("This file does not appear to be a PDF.");
  if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
  progress("Opening PDF…");
  // PDF.js owns its parsing worker. Its display-side loader needs the browser document.
  const task = pdfjs.getDocument({ data: bytes, ...pdfOptions() });
  let timedOut = false;
  const abort = () => {
    void task.destroy();
  };
  signal.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(() => {
    timedOut = true;
    void task.destroy();
  }, 60_000);
  try {
    const doc = await task.promise;
    if (doc.numPages > 20)
      throw new Error("Choose a PDF with 20 pages or fewer.");
    const result: Extracted = {
      text: "",
      pages: doc.numPages,
      warnings: [
        "Check job boundaries, dates and reading order. PDF columns may be combined.",
      ],
      scanPages: [],
    };
    for (let p = 1; p <= doc.numPages; p++) {
      if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
      progress(`Reading page ${p} of ${doc.numPages}…`);
      const page = await doc.getPage(p);
      const tc = await page.getTextContent();
      const items = tc.items.filter(
        (i): i is import("pdfjs-dist/types/src/display/api").TextItem =>
          "str" in i,
      );
      const lines: { y: number; items: typeof items }[] = [];
      for (const item of items) {
        const y = item.transform[5];
        let line = lines.find((l) => Math.abs(l.y - y) < 2.5);
        if (!line) {
          line = { y, items: [] };
          lines.push(line);
        }
        line.items.push(item);
      }
      lines.sort((a, b) => b.y - a.y);
      const text = lines
        .map((l) =>
          l.items
            .sort((a, b) => a.transform[4] - b.transform[4])
            .map((i) => i.str)
            .join(" ")
            .trim(),
        )
        .filter(Boolean)
        .join("\n");
      if (text.replace(/\s/g, "").length < 30) result.scanPages.push(p);
      result.text += `\n[Page ${p}]\n${text}\n`;
      page.cleanup();
    }
    if (result.text.length > 500_000)
      throw new Error(
        "The extracted text is too large. Choose a shorter document.",
      );
    if (result.scanPages.length)
      result.warnings.push(
        `Pages ${result.scanPages.join(", ")} contain little readable text. Use scan recognition to recover them.`,
      );
    return result;
  } catch (e) {
    if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
    if (timedOut)
      throw new Error("This PDF took too long to read. Try a smaller file.");
    if ((e as Error).name === "PasswordException")
      throw new Error(
        "This PDF is password-protected. Unlock a copy on your device, then import it again.",
      );
    throw e;
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", abort);
    await task.destroy();
  }
}
