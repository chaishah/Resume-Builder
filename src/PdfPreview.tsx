import { useEffect, useRef, useState } from "react";
import { pdfjs, pdfOptions } from "./pdfjs";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { LoaderCircle, AlertCircle } from "lucide-react";
function PdfPage({ pdf, page }: { pdf: PDFDocumentProxy; page: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(page === 1);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "300px" },
    );
    if (box.current) observer.observe(box.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!visible) return;
    let cancel = false;
    let task:
      | ReturnType<Awaited<ReturnType<PDFDocumentProxy["getPage"]>>["render"]>
      | undefined;
    void pdf
      .getPage(page)
      .then((p) => {
        if (cancel || !canvas.current) return;
        const view = p.getViewport({
          scale: Math.min(window.devicePixelRatio || 1, 1.6),
        });
        canvas.current.width = view.width;
        canvas.current.height = view.height;
        task = p.render({ canvas: canvas.current, viewport: view });
        return task.promise;
      })
      .catch((e) => {
        if (e.name !== "RenderingCancelledException" && !cancel)
          console.error("Page preview failed");
      });
    return () => {
      cancel = true;
      task?.cancel();
    };
  }, [pdf, page, visible]);
  return (
    <div className="pdf-page" ref={box}>
      <canvas ref={canvas} aria-label={`Document page ${page}`} role="img" />
    </div>
  );
}
export default function PdfPreview({
  blob,
  onInfo,
}: {
  blob: Blob;
  onInfo?: (info: { pages: number; text: string }) => void;
}) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState("");
  const infoRef = useRef(onInfo);
  infoRef.current = onInfo;
  useEffect(() => {
    let active = true;
    let task: ReturnType<typeof pdfjs.getDocument> | undefined;
    setPdf(null);
    setError("");
    void blob
      .arrayBuffer()
      .then(async (data) => {
        if (!active) return;
        task = pdfjs.getDocument({ data, ...pdfOptions() });
        const loaded = await task.promise;
        if (!active) return;
        setPdf(loaded);
        let text = "";
        for (let p = 1; p <= loaded.numPages; p++) {
          if (!active) return;
          const page = await loaded.getPage(p);
          const content = await page.getTextContent();
          text +=
            `Page ${p}\n` +
            content.items
              .map((i) => ("str" in i ? i.str + (i.hasEOL ? "\n" : " ") : ""))
              .join("") +
            "\n\n";
        }
        if (active) infoRef.current?.({ pages: loaded.numPages, text });
      })
      .catch((e) => {
        if (active)
          setError(
            e.message ||
              "Preview unavailable. You can still download the document.",
          );
      });
    return () => {
      active = false;
      void task?.destroy();
    };
  }, [blob]);
  if (error)
    return (
      <div className="notice error">
        <AlertCircle size={18} />
        {error}
      </div>
    );
  if (!pdf)
    return (
      <div className="preview-loading">
        <LoaderCircle className="spin" />
        Opening document…
      </div>
    );
  return (
    <div className="pdf-pages">
      {Array.from({ length: pdf.numPages }, (_, i) => (
        <PdfPage key={i + 1} pdf={pdf} page={i + 1} />
      ))}
    </div>
  );
}
