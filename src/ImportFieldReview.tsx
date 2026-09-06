import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { Area, Select } from "./ui";
import { ProfileEditor, SectionEditor, type Change } from "./EditorForms";
import type { Resume } from "./model";
export default function ImportFieldReview({
  original,
  initial,
  onCreate,
}: {
  original: string;
  initial: Resume;
  onCreate: (doc: Resume) => Promise<void>;
}) {
  const [doc, setDoc] = useState(initial),
    [section, setSection] = useState("profile"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const change: Change = (recipe) =>
    setDoc((prev) => {
      const next = structuredClone(prev);
      recipe(next);
      return next;
    });
  const active = doc.sections.find((s) => s.id === section);
  return (
    <>
      <p>
        Check your details against the original text. Separate grouped jobs with
        “Add another entry”, then correct employers and dates before creating
        your draft.
      </p>
      <div className="import-review-grid">
        <details className="import-source" open>
          <summary>Original extracted text</summary>
          <pre>{original}</pre>
        </details>
        <div className="import-field-editor">
          <Select label="Review section" value={section} onChange={setSection}>
            <option value="profile">Contact & summary</option>
            {doc.sections.map((s) => (
              <option value={s.id} key={s.id}>
                {s.title}
              </option>
            ))}
            <option value="notes">Unassigned import text</option>
          </Select>
          {section === "profile" ? (
            <ProfileEditor doc={doc} change={change} />
          ) : active ? (
            <SectionEditor
              key={active.id}
              section={active}
              change={change}
              temporary
              onMessage={setError}
            />
          ) : (
            <Area
              label="Unassigned import text"
              value={doc.importNotes}
              rows={14}
              hint="Keep useful details here until you move them into your résumé. These notes are excluded from PDF exports."
              onChange={(e) =>
                change((d) => {
                  d.importNotes = e.target.value;
                })
              }
            />
          )}
        </div>
      </div>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      <div className="modal-actions">
        <button
          className="primary"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void onCreate(doc)
              .catch((e) => setError((e as Error).message))
              .finally(() => setBusy(false));
          }}
        >
          {busy ? "Creating…" : "Create editable draft"}
          <ArrowRight size={16} />
        </button>
      </div>
    </>
  );
}
