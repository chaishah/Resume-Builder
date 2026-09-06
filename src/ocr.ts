import type { Extracted } from "./importer";
export async function recogniseScan(
  file: File,
  existing: Extracted,
  onProgress: (text: string) => void,
  signal: AbortSignal,
): Promise<Extracted> {
  const { createWorker } = await import("tesseract.js");
  const root = new URL(import.meta.env.BASE_URL, location.origin).href;
  const worker = await createWorker("eng", 1, {
    workerPath: `${root}ocr/worker.min.js`,
    corePath: `${root}ocr/core`,
    langPath: `${root}ocr/lang`,
    logger: (m) => {
      if (m.status === "recognizing text")
        onProgress(`Recognising text · ${Math.round(m.progress * 100)}%`);
    },
  });
  const abort = () => {
    void worker.terminate();
  };
  signal.addEventListener("abort", abort, { once: true });
  const check = () => {
    if (signal.aborted)
      throw new DOMException("Scan recognition cancelled", "AbortError");
  };
  let text = existing.text;
  try {
    check();
    if (file.name.toLowerCase().endsWith(".pdf")) {
      const { pdfjs, pdfOptions } = await import("./pdfjs");
      const task = pdfjs.getDocument({
        data: await file.arrayBuffer(),
        ...pdfOptions(),
      });
      try {
        const doc = await task.promise;
        for (const p of existing.scanPages) {
          check();
          onProgress(`Preparing scan page ${p}…`);
          const page = await doc.getPage(p);
          const natural = page.getViewport({ scale: 1 });
          const view = page.getViewport({
            scale: Math.min(2, 1800 / natural.width),
          });
          const canvas = document.createElement("canvas");
          canvas.width = view.width;
          canvas.height = view.height;
          try {
            await page.render({ canvas, viewport: view }).promise;
            check();
            const result = await worker.recognize(canvas);
            const marker = `[Page ${p}]`;
            const start = text.indexOf(marker),
              end = text.indexOf("[Page ", start + marker.length);
            if (start >= 0)
              text =
                text.slice(0, start) +
                `${marker}\n${result.data.text}\n` +
                (end >= 0 ? text.slice(end) : "");
            else text += `\n${marker}\n${result.data.text}\n`;
          } finally {
            canvas.width = 0;
            canvas.height = 0;
            page.cleanup();
          }
        }
      } finally {
        await task.destroy();
      }
    } else {
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement("canvas");
      const scale = Math.min(1, 2200 / Math.max(bitmap.width, bitmap.height));
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      canvas
        .getContext("2d")!
        .drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      try {
        check();
        text = (await worker.recognize(canvas)).data.text;
      } finally {
        canvas.width = 0;
        canvas.height = 0;
      }
    }
    check();
    return {
      ...existing,
      text,
      scanPages: [],
      warnings: [
        "Scan recognition can misread names, numbers and dates. Review every field before using it.",
      ],
    };
  } finally {
    signal.removeEventListener("abort", abort);
    await worker.terminate();
  }
}
