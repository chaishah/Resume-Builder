import { useEffect, useRef, useState } from "react";
import { pdfjs, pdfOptions } from "./pdfjs";
import { readPdfPageText } from "./pdf-text";
import type { PDFDocumentProxy } from "pdfjs-dist";
import {
  LoaderCircle,
  AlertCircle,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type { PdfRegion } from "./preview-navigation";
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
  zoom,
  regions,
  labels,
  onEdit,
}: {
  pdf: PDFDocumentProxy;
  page: number;
  url: string;
  zoom: number;
  regions: PdfRegion[];
  labels?: Record<string, string>;
  onEdit?: (target: string) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(page === 1);
  const [renderZoom, setRenderZoom] = useState(zoom);
  useEffect(() => {
    const timer = setTimeout(() => setRenderZoom(zoom), 120);
    return () => clearTimeout(timer);
  }, [zoom]);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [dimensions, setDimensions] = useState({
    width: 595.28,
    height: 841.89,
  });
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
          scale: Math.min(
            ((window.devicePixelRatio || 1) * renderZoom) / 100,
            3,
          ),
        });
        setDimensions({
          width: p.getViewport({ scale: 1 }).width,
          height: p.getViewport({ scale: 1 }).height,
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
  }, [pdf, page, visible, attempt, renderZoom]);
  const pageRegions = regions.filter((r) => r.page === page);
  return (
    <div className="pdf-page" ref={box} data-page={page}>
      {error && (
        <PreviewRecovery url={url} retry={() => setAttempt((n) => n + 1)} />
      )}
      {!error &&
        onEdit &&
        pageRegions.map((region, i) => (
          <button
            key={`${region.target}-${i}`}
            className="pdf-edit-hit"
            aria-label={labels?.[region.target] || "Edit this text"}
            title={labels?.[region.target] || "Edit this text"}
            style={{
              left: `${(region.x / dimensions.width) * 100}%`,
              top: `${(region.y / dimensions.height) * 100}%`,
              width: `${(region.width / dimensions.width) * 100}%`,
              height: `${(region.height / dimensions.height) * 100}%`,
            }}
            onClick={() => onEdit(region.target)}
          />
        ))}
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
  onEdit,
  editLabels,
  editRegions = [],
}: {
  blob: Blob;
  onInfo?: (info: PdfInfo) => void;
  onEdit?: (target: string) => void;
  editLabels?: Record<string, string>;
  editRegions?: PdfRegion[];
}) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState(false);
  const [textError, setTextError] = useState("");
  const [url, setUrl] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [zoom, setZoom] = useState(100),
    [currentPage, setCurrentPage] = useState(1);
  const pan = useRef<HTMLDivElement>(null);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  useEffect(() => {
    const el = pan.current;
    if (!el) return;
    let pinch: { distance: number; zoom: number } | null = null;
    const distance = (e: TouchEvent) =>
      Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      );
    const start = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        pinch = { distance: distance(e), zoom: zoomRef.current };
      }
    };
    const move = (e: TouchEvent) => {
      if (pinch && e.touches.length === 2) {
        e.preventDefault();
        setZoom(
          Math.max(
            75,
            Math.min(
              250,
              Math.round(
                (pinch.zoom * distance(e)) / Math.max(1, pinch.distance),
              ),
            ),
          ),
        );
      }
    };
    const end = () => {
      pinch = null;
    };
    el.addEventListener("touchstart", start, { passive: false });
    el.addEventListener("touchmove", move, { passive: false });
    el.addEventListener("touchend", end);
    el.addEventListener("touchcancel", end);
    return () => {
      el.removeEventListener("touchstart", start);
      el.removeEventListener("touchmove", move);
      el.removeEventListener("touchend", end);
      el.removeEventListener("touchcancel", end);
    };
  }, [pdf]);
  const goToPage = (n: number) => {
    setCurrentPage(n);
    pan.current?.querySelector(`[data-page="${n}"]`)?.scrollIntoView({
      block: "start",
      inline: "nearest",
      behavior: "smooth",
    });
  };
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
    setCurrentPage(1);
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
    <div className="pdf-viewer">
      <div className="pdf-controls" aria-label="PDF preview controls">
        <button
          aria-label="Zoom out"
          disabled={zoom <= 75}
          onClick={() => setZoom((n) => Math.max(75, n - 25))}
        >
          <ZoomOut size={17} />
        </button>
        <button onClick={() => setZoom(100)} title="Fit page width">
          Fit width
        </button>
        <span aria-live="polite">{zoom}%</span>
        <button
          aria-label="Zoom in"
          disabled={zoom >= 250}
          onClick={() => setZoom((n) => Math.min(250, n + 25))}
        >
          <ZoomIn size={17} />
        </button>
        <button
          aria-label="Previous PDF page"
          disabled={currentPage <= 1}
          onClick={() => goToPage(currentPage - 1)}
        >
          <ChevronLeft size={17} />
        </button>
        <label className="pdf-page-select">
          Page
          <select
            aria-label="Go to PDF page"
            value={currentPage}
            onChange={(e) => goToPage(Number(e.target.value))}
          >
            {Array.from({ length: pdf.numPages }, (_, i) => (
              <option key={i} value={i + 1}>
                {i + 1} / {pdf.numPages}
              </option>
            ))}
          </select>
        </label>
        <button
          aria-label="Next PDF page"
          disabled={currentPage >= pdf.numPages}
          onClick={() => goToPage(currentPage + 1)}
        >
          <ChevronRight size={17} />
        </button>
      </div>
      {onEdit && (
        <p className="preview-hint">
          Tap any heading or paragraph to edit. Pinch or use + / − to zoom.
        </p>
      )}
      {textError && (
        <div className="notice" role="status">
          {textError}
        </div>
      )}
      <div
        className="pdf-pan"
        ref={pan}
        onScroll={() => {
          const el = pan.current;
          if (!el) return;
          const pages = [...el.querySelectorAll<HTMLElement>("[data-page]")];
          const top = el.getBoundingClientRect().top;
          const nearest = pages.sort(
            (a, b) =>
              Math.abs(a.getBoundingClientRect().top - top) -
              Math.abs(b.getBoundingClientRect().top - top),
          )[0];
          if (nearest) setCurrentPage(Number(nearest.dataset.page));
        }}
      >
        <div
          className="pdf-pages"
          style={{ width: `${zoom}%`, maxWidth: "none" }}
        >
          {Array.from({ length: pdf.numPages }, (_, i) => (
            <PdfPage
              key={i + 1}
              pdf={pdf}
              page={i + 1}
              url={url}
              zoom={zoom}
              regions={editRegions}
              labels={editLabels}
              onEdit={onEdit}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
