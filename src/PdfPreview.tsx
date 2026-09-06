import { useEffect, useRef, useState } from "react";
import { pdfjs, pdfOptions } from "./pdfjs";
import { readPdfPageText } from "./pdf-text";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { LoaderCircle, AlertCircle } from "lucide-react";
export type PdfInfo = { pages: number; text: string; textError?: string };
function PreviewRecovery({ url, retry }: { url: string; retry: () => void }) {
  return (
    <div className="notice error" role="alert">
      <AlertCircle size={18} />
      <div>
        <p>
          This preview could not be displayed. You can still open or save the
          PDF.
        </p>
        {url && (
          <a
            className="text-button"
            href={url}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open PDF
          </a>
        )}
        <button onClick={retry}>Try preview again</button>
      </div>
    </div>
  );
}
function PdfPage({
  pdf,
  page,
  url,
}: {
  pdf: PDFDocumentProxy;
  page: number;
  url: string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(page === 1);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
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
    setError(false);
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
        if (e.name !== "RenderingCancelledException" && !cancel) {
          console.error("Page preview failed", e);
          setError(true);
        }
      });
    return () => {
      cancel = true;
      task?.cancel();
    };
  }, [pdf, page, visible, attempt]);
  return (
    <div className="pdf-page" ref={box}>
      {error && (
        <PreviewRecovery url={url} retry={() => setAttempt((n) => n + 1)} />
      )}
      <canvas
        ref={canvas}
        style={error ? { display: "none" } : undefined}
        aria-label={`Document page ${page}`}
        role="img"
      />
    </div>
  );
}
export default function PdfPreview({
  blob,
  onInfo,
}: {
  blob: Blob;
  onInfo?: (info: PdfInfo) => void;
}) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState(false);
  const [textError, setTextError] = useState("");
  const [url, setUrl] = useState("");
  const [attempt, setAttempt] = useState(0);
  const infoRef = useRef(onInfo);
  infoRef.current = onInfo;
  useEffect(() => {
    const next = URL.createObjectURL(blob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [blob]);
  useEffect(() => {
    let active = true;
    let task: ReturnType<typeof pdfjs.getDocument> | undefined;
    setPdf(null);
    setError(false);
    setTextError("");
    void blob
      .arrayBuffer()
      .then(async (data) => {
        if (!active) return;
        task = pdfjs.getDocument({ data, ...pdfOptions() });
        const loaded = await task.promise;
        if (!active) return;
        setPdf(loaded);
        infoRef.current?.({ pages: loaded.numPages, text: "" });
        // Text checking is independent of painting the PDF. A text failure must
        // never replace otherwise readable pages with an error screen.
        try {
          let text = "";
          for (let p = 1; p <= loaded.numPages; p++) {
            if (!active) return;
            const page = await loaded.getPage(p);
            const content = await readPdfPageText(page);
            text +=
              `Page ${p}\n` +
              content.items
                .map((i) => ("str" in i ? i.str + (i.hasEOL ? "\n" : " ") : ""))
                .join("") +
              "\n\n";
          }
          if (active) infoRef.current?.({ pages: loaded.numPages, text });
        } catch (e) {
          if (!active) return;
          console.error("PDF text check failed", e);
          const message =
            "The plain-text check is unavailable. You can still preview and download the PDF.";
          setTextError(message);
          infoRef.current?.({
            pages: loaded.numPages,
            text: "",
            textError: message,
          });
        }
      })
      .catch((e) => {
        if (active) {
          console.error("PDF preview could not open", e);
          setError(true);
        }
      });
    return () => {
      active = false;
      void task?.destroy();
    };
  }, [blob, attempt]);
  if (error)
    return <PreviewRecovery url={url} retry={() => setAttempt((n) => n + 1)} />;
  if (!pdf)
    return (
      <div className="preview-loading">
        <LoaderCircle className="spin" />
        Opening document…
      </div>
    );
  return (
    <div className="pdf-pages">
      {textError && (
        <div className="notice" role="status">
          {textError}
        </div>
      )}
      {Array.from({ length: pdf.numPages }, (_, i) => (
        <PdfPage key={i + 1} pdf={pdf} page={i + 1} url={url} />
      ))}
    </div>
  );
}
