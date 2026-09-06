import { lazy, Suspense, useEffect, useState } from "react";
import {
  Download,
  FileText,
  Check,
  AlertCircle,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import type { Resume } from "./model";
import { reviewDocument, fileName, toText } from "./model";
import { Modal, Field, Select, Loading } from "./ui";
import { generatePdf, generateDocx, documentText } from "./exporter";
import { downloadBlob } from "./storage";
import type { DocumentKind } from "./document";
import type { PdfInfo } from "./PdfPreview";
const PdfPreview = lazy(() => import("./PdfPreview"));
export function usePDF(
  doc: Resume,
  kind: DocumentKind = "resume",
  delay = 750,
) {
  const key = JSON.stringify([
    doc.profile,
    doc.sections,
    doc.design,
    kind,
    kind === "resume"
      ? null
      : [
          doc.application.role,
          doc.application.company,
          doc.coverLetter,
          doc.application.criteria,
        ],
  ]);
  const [result, setResult] = useState<{ blob: Blob; key: string } | null>(
      null,
    ),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    setError("");
    const abort = new AbortController();
    const timeout = setTimeout(() => {
      void generatePdf(doc, kind, abort.signal)
        .then((blob) => {
          if (!abort.signal.aborted) setResult({ blob, key });
        })
        .catch((e) => {
          if (e.name !== "AbortError" && !abort.signal.aborted)
            setError(e.message);
        });
    }, delay);
    return () => {
      clearTimeout(timeout);
      abort.abort();
    };
  }, [key, retry]);
  return {
    blob: result?.key === key ? result.blob : null,
    previous: result?.blob,
    error,
    retry: () => setRetry((r) => r + 1),
  };
}
export function LivePreview({
  doc,
  onExport,
}: {
  doc: Resume;
  onExport: () => void;
}) {
  const { blob, previous, error, retry } = usePDF(doc);
  const [pages, setPages] = useState(0);
  return (
    <aside className="live-preview" aria-label="Résumé preview">
      <div className="preview-heading">
        <div>
          <span className="eyebrow">Your document</span>
          <h3>A little more you.</h3>
        </div>
        <span className="tag">
          A4
          {blob && pages ? ` · ${pages} ${pages === 1 ? "page" : "pages"}` : ""}
        </span>
      </div>
      {error ? (
        <div className="notice error">
          <AlertCircle size={18} />
          <div>
            {error}
            <button onClick={retry}>
              <RefreshCw size={15} />
              Try again
            </button>
          </div>
        </div>
      ) : (
        <>
          <div
            className={`preview-surface ${!blob && previous ? "updating" : ""}`}
          >
            {previous ? (
              <Suspense fallback={<Loading>Opening preview…</Loading>}>
                <PdfPreview
                  blob={blob || previous}
                  onInfo={(i) => setPages(i.pages)}
                />
              </Suspense>
            ) : (
              <div className="blank-paper">
                <FileText size={35} />
                <p>Preparing your first preview…</p>
              </div>
            )}
          </div>
          {!blob && (
            <span className="preview-status" role="status">
              Updating preview…
            </span>
          )}
        </>
      )}
      {blob && pages > doc.design.pageLimit && (
        <div className="notice">
          {pages} pages · Your target is {doc.design.pageLimit}. Review spacing
          or less relevant entries.
        </div>
      )}
      <button className="primary full-button" onClick={onExport}>
        <Download size={17} />
        Review & download
      </button>
      <p className="preview-caption">
        Actual PDF preview. Your content stays on this device.
      </p>
    </aside>
  );
}
export function ExportDialog({
  doc,
  kind = "resume",
  onClose,
  onDownloaded,
}: {
  doc: Resume;
  kind?: DocumentKind;
  onClose: () => void;
  onDownloaded: (label: string) => void;
}) {
  const { blob, error, retry } = usePDF(doc, kind, 100);
  const [info, setInfo] = useState<PdfInfo>({ pages: 0, text: "" }),
    [format, setFormat] = useState(
      doc.application.requestedFormat === "docx" ? "docx" : "pdf",
    ),
    [name, setName] = useState(
      fileName(
        doc,
        kind === "resume"
          ? "Resume"
          : kind === "letter"
            ? "Cover-Letter"
            : "Selection-Criteria",
      ),
    ),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [tab, setTab] = useState("preview");
  const checks = kind === "resume" ? reviewDocument(doc) : [];
  const download = async () => {
    setBusy(true);
    setMessage("");
    try {
      if (format === "pdf") {
        if (!blob) throw new Error("Wait for the latest preview to finish.");
        downloadBlob(blob, `${name || "Resume"}.pdf`);
      } else if (format === "docx")
        downloadBlob(await generateDocx(doc, kind), `${name || "Resume"}.docx`);
      else
        downloadBlob(
          new Blob([documentText(doc, kind)], {
            type: "text/plain;charset=utf-8",
          }),
          `${name || "Resume"}.txt`,
        );
      onDownloaded(
        `Downloaded ${kind === "resume" ? "résumé" : kind === "letter" ? "cover letter" : "criteria"} · ${new Date().toLocaleDateString("en-AU")}`,
      );
      setMessage(
        "Your download is ready. On iPhone, check Downloads or use Open / Share PDF.",
      );
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const share = async () => {
    if (!blob) return;
    const file = new File([blob], `${name || "Resume"}.pdf`, {
      type: "application/pdf",
    });
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: name });
        onDownloaded("Shared PDF");
      } else {
        const url = URL.createObjectURL(blob);
        window.open(url, "_blank", "noopener");
        setTimeout(() => URL.revokeObjectURL(url), 120_000);
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError")
        setMessage("Use Download to save the PDF on this device.");
    }
  };
  return (
    <Modal
      title={
        kind === "resume"
          ? "Ready for your next chapter."
          : kind === "letter"
            ? "Your matching cover letter"
            : "Your selection-criteria responses"
      }
      onClose={onClose}
      wide
    >
      <div className="export-controls">
        <Field
          label="File name"
          value={name}
          onChange={(e) =>
            setName(e.target.value.replace(/[\\/:*?"<>|]/g, "-"))
          }
        />
        <Select label="Format" value={format} onChange={setFormat}>
          <option value="pdf">PDF</option>
          <option value="docx">Word (.docx)</option>
          <option value="txt">Plain text (.txt)</option>
        </Select>
        <button
          className="primary align-end"
          disabled={busy || (format === "pdf" && !blob)}
          onClick={() => void download()}
        >
          <Download size={17} />
          {busy ? "Preparing…" : "Download"}
        </button>
      </div>
      {format === "docx" && (
        <div className="notice">
          Word output uses editable text and matching colours. Its pagination
          and font substitutions may differ from this PDF preview.
        </div>
      )}
      {message && (
        <div className="notice" role="status">
          {message}
        </div>
      )}
      {doc.application.company && (
        <p>
          Application:{" "}
          <strong>
            {doc.application.role || "Role"} · {doc.application.company}
          </strong>
        </p>
      )}
      {!!checks.length && (
        <details className="review-checklist" open>
          <summary>
            {checks.filter((c) => c.level === "review").length} items to check ·{" "}
            {checks.filter((c) => c.level === "tip").length} writing tips
          </summary>
          <ul>
            {checks.map((c, i) => (
              <li key={i}>{c.label}</li>
            ))}
          </ul>
        </details>
      )}
      {!checks.length && kind === "resume" && (
        <div className="notice">
          <Check size={18} />
          The basic contact and content checks look good. Read through the final
          document before sending it.
        </div>
      )}
      {blob && (
        <div className="label-row">
          <span className="tag">
            {info.pages || "…"} {info.pages === 1 ? "page" : "pages"} · A4
            {kind === "resume" ? ` · Target: ${doc.design.pageLimit}` : ""}
          </span>
          <button className="text-button" onClick={() => void share()}>
            <ExternalLink size={16} />
            Open / Share PDF
          </button>
        </div>
      )}
      {blob && kind === "resume" && info.pages > doc.design.pageLimit && (
        <div className="notice">
          This document exceeds your {doc.design.pageLimit}-page target. You can
          adjust spacing, hide less relevant entries or use a higher target if
          the employer allows it.
        </div>
      )}
      <div className="segmented">
        <button
          className={tab === "preview" ? "active" : ""}
          onClick={() => setTab("preview")}
        >
          PDF preview
        </button>
        <button
          className={tab === "text" ? "active" : ""}
          onClick={() => setTab("text")}
        >
          Plain-text check
        </button>
        <button
          className={tab === "budget" ? "active" : ""}
          onClick={() => setTab("budget")}
        >
          Page budget
        </button>
      </div>
      {error ? (
        <div className="notice error">
          <span>{error}</span>
          <button onClick={retry}>Retry PDF</button>
        </div>
      ) : !blob ? (
        <Loading>Generating the latest document…</Loading>
      ) : (
        <div
          className={tab === "preview" ? "export-preview" : "visually-hidden"}
        >
          <Suspense fallback={<Loading>Opening preview…</Loading>}>
            <PdfPreview blob={blob} onInfo={setInfo} />
          </Suspense>
        </div>
      )}
      {tab === "text" && (
        <>
          <p className="muted">
            Text extracted from the actual PDF, in extraction order. This is one
            useful check, not a simulation of every recruitment platform.
          </p>
          <pre className="text-check">
            {info.textError || info.text || "Extracting PDF text…"}
          </pre>
        </>
      )}
      {tab === "budget" && (
        <>
          <p className="muted">
            Approximate content share by word count. Actual space varies with
            headings, bullets and page breaks.
          </p>
          {(kind === "resume"
            ? [
                {
                  title: "Contact details & summary",
                  text: Object.values(doc.profile).join(" "),
                },
                ...doc.sections
                  .filter((s) => !s.hidden)
                  .map((s) => ({
                    title: s.title,
                    text: s.entries
                      .map((e) =>
                        [e.title, e.subtitle, e.description, ...e.bullets].join(
                          " ",
                        ),
                      )
                      .join(" "),
                  })),
              ]
            : [
                {
                  title:
                    kind === "letter" ? "Cover letter" : "Selection criteria",
                  text: documentText(doc, kind),
                },
              ]
          ).map((s, i) => {
            const words = s.text.split(/\s+/).filter(Boolean).length;
            const total = documentText(doc, kind)
              .split(/\s+/)
              .filter(Boolean).length;
            return (
              <div className="budget-row" key={i}>
                <div>
                  <strong>{s.title}</strong>
                  <span>{words} words</span>
                </div>
                <meter
                  min="0"
                  max={Math.max(total, words, 1)}
                  value={words}
                  aria-label={`${s.title}: ${words} words`}
                />
              </div>
            );
          })}
          <p className="muted">
            Adjust section order, visibility, spacing and explicit page breaks
            in the editor. Content is never removed automatically.
          </p>
        </>
      )}
    </Modal>
  );
}
