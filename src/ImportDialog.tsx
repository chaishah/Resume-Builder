import { useState, useRef, useEffect } from "react";
import {
  Upload,
  FileText,
  ScanText,
  ArrowRight,
  AlertCircle,
} from "lucide-react";
import { Modal, Area, Select, Loading } from "./ui";
import {
  extractFile,
  splitImport,
  importBlocks,
  importSectionOptions,
  type Extracted,
  type ImportBlock,
} from "./importer";
import { uid, type Resume } from "./model";
import ImportFieldReview from "./ImportFieldReview";
type Props = {
  onClose: () => void;
  onImport: (d: Resume) => Promise<void>;
  onBackup: (file: File) => Promise<void>;
  startPaste?: boolean;
};
export default function ImportDialog({
  onClose,
  onImport,
  onBackup,
  startPaste = false,
}: Props) {
  const [mode, setMode] = useState<"file" | "paste">(
      startPaste ? "paste" : "file",
    ),
    [paste, setPaste] = useState(""),
    [file, setFile] = useState<File | null>(null),
    [extracted, setExtracted] = useState<Extracted | null>(null),
    [blocks, setBlocks] = useState<ImportBlock[]>([]),
    [progress, setProgress] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [reviewDraft, setReviewDraft] = useState<Resume | null>(null);
  const abort = useRef<AbortController | null>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => () => abort.current?.abort(), []);
  const review = (data: Extracted) => {
    setExtracted(data);
    setBlocks(splitImport(data.text));
  };
  const pick = async (f: File) => {
    setError("");
    setBusy(true);
    setFile(f);
    setProgress("Reading your document…");
    abort.current?.abort();
    abort.current = new AbortController();
    try {
      if (f.name.toLowerCase().endsWith(".json")) {
        await onBackup(f);
        onClose();
        return;
      }
      const data = await extractFile(f, setProgress, abort.current.signal);
      review(data);
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const ocr = async () => {
    if (!file || !extracted) return;
    setBusy(true);
    setError("");
    setProgress("Loading scan recognition. The first load is larger…");
    abort.current = new AbortController();
    try {
      const { recogniseScan } = await import("./ocr");
      review(
        await recogniseScan(file, extracted, setProgress, abort.current.signal),
      );
    } catch (e) {
      if ((e as Error).name !== "AbortError")
        setError(
          (e as Error).message ||
            "Scan recognition failed. Try a clearer image or paste text.",
        );
    } finally {
      setBusy(false);
    }
  };
  const close = () => {
    abort.current?.abort();
    onClose();
  };
  return (
    <Modal
      title={
        extracted
          ? "Review your imported content"
          : "Bring your experience with you"
      }
      onClose={close}
      wide
    >
      <p className="muted">
        Your document is processed on this device. Original styling will be
        replaced by your chosen template.
      </p>
      {error && (
        <div className="notice error" role="alert">
          <AlertCircle size={18} />
          {error}
        </div>
      )}
      {reviewDraft && extracted ? (
        <ImportFieldReview
          original={extracted.text}
          initial={reviewDraft}
          onCreate={async (doc) => {
            await onImport(doc);
            onClose();
          }}
        />
      ) : busy ? (
        <>
          <Loading>{progress}</Loading>
          <button
            onClick={() => {
              abort.current?.abort();
              setBusy(false);
            }}
          >
            Cancel processing
          </button>
        </>
      ) : !extracted ? (
        <>
          <div className="segmented">
            <button
              className={mode === "file" ? "active" : ""}
              onClick={() => setMode("file")}
            >
              <Upload size={16} />
              Choose a file
            </button>
            <button
              className={mode === "paste" ? "active" : ""}
              onClick={() => setMode("paste")}
            >
              <FileText size={16} />
              Paste text
            </button>
          </div>
          {mode === "file" ? (
            <div
              className="drop-zone"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files[0]) void pick(e.dataTransfer.files[0]);
              }}
            >
              <Upload size={30} />
              <h3>Drop your résumé here</h3>
              <p>PDF, DOCX, TXT, PNG, JPEG or a Resume Studio backup</p>
              <button
                className="primary"
                onClick={() => input.current?.click()}
              >
                Choose from your device
              </button>
              <small>Documents up to 10 MB · PDFs up to 20 pages</small>
              <input
                ref={input}
                hidden
                type="file"
                accept=".pdf,.docx,.txt,.md,.png,.jpg,.jpeg,.json"
                onChange={(e) => {
                  if (e.target.files?.[0]) void pick(e.target.files[0]);
                }}
              />
            </div>
          ) : (
            <>
              <Area
                label="Your existing résumé or experience"
                rows={12}
                value={paste}
                onChange={(e) => setPaste(e.target.value)}
                placeholder="Paste your contact details, experience, education and skills…"
                maxLength={500000}
              />
              <button
                className="primary"
                disabled={!paste.trim()}
                onClick={() =>
                  review({ text: paste, pages: 1, warnings: [], scanPages: [] })
                }
              >
                Review content <ArrowRight size={16} />
              </button>
            </>
          )}
        </>
      ) : (
        <>
          {!!extracted.warnings.length && (
            <div className="notice vertical">
              {extracted.warnings.map((w) => (
                <p key={w}>{w}</p>
              ))}
            </div>
          )}
          {!!extracted.scanPages.length && (
            <button className="primary" onClick={() => void ocr()}>
              <ScanText size={17} />
              Recognise scanned pages
            </button>
          )}
          {blocks.map((block, i) => (
            <div className="import-block" key={block.id}>
              <div className="import-block-head">
                <span className="eyebrow">
                  Block {i + 1}
                  {block.page ? ` · Page ${block.page}` : ""}
                </span>
                <Select
                  label="Assign to"
                  value={block.section}
                  onChange={(v) =>
                    setBlocks((prev) =>
                      prev.map((b) =>
                        b.id === block.id
                          ? { ...b, section: v as ImportBlock["section"] }
                          : b,
                      ),
                    )
                  }
                >
                  {importSectionOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </div>
              <Area
                label={`Extracted text ${i + 1}`}
                rows={Math.min(9, Math.max(3, block.text.split("\n").length))}
                value={block.text}
                onChange={(e) =>
                  setBlocks((prev) =>
                    prev.map((b) =>
                      b.id === block.id ? { ...b, text: e.target.value } : b,
                    ),
                  )
                }
              />
              <button
                className="text-button"
                onClick={() => {
                  const at = block.text.indexOf("\n\n");
                  if (at >= 0) {
                    const copy = [...blocks];
                    copy.splice(
                      i,
                      1,
                      { ...block, text: block.text.slice(0, at) },
                      { ...block, id: uid(), text: block.text.slice(at + 2) },
                    );
                    setBlocks(copy);
                  } else
                    setError(
                      "Add a blank line where you want this block to split, then try again.",
                    );
                }}
              >
                Split at first blank line
              </button>
            </div>
          ))}
          <p className="muted">
            Assign the blocks first. Next, review individual fields beside the
            original text and separate any grouped jobs.
          </p>
          <div className="modal-actions">
            <button
              onClick={() => {
                setExtracted(null);
                setBlocks([]);
              }}
            >
              Choose another document
            </button>
            <button
              className="primary"
              disabled={!blocks.some((b) => b.text.trim())}
              onClick={async () => {
                try {
                  setReviewDraft(importBlocks(blocks));
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Review individual fields <ArrowRight size={16} />
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
