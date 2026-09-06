import { useEffect, useState } from "react";
import {
  Plus,
  Check,
  Search,
  Copy,
  Bookmark,
  Trash2,
  History,
  ArrowRight,
} from "lucide-react";
import { Area, Field, Select, Modal, Empty, Confirm } from "./ui";
import {
  roleCoverage,
  snapshotDiff,
  newSection,
  newEntry,
  uid,
  sectionNames,
  type Resume,
  type CareerItem,
  type Snapshot,
  type SectionType,
} from "./model";
import { db, createSnapshot } from "./storage";
import type { Change } from "./EditorForms";
import type { DocumentKind } from "./document";
export function TailorEditor({
  doc,
  change,
  onVariant,
}: {
  doc: Resume;
  change: Change;
  onVariant: () => void;
}) {
  const coverage = roleCoverage(doc);
  return (
    <>
      <div className="panel-title">
        <span className="eyebrow">A résumé for this opportunity</span>
        <h2>Make the connection.</h2>
        <p>
          Keep the job details alongside your draft. Choose examples that show
          why you fit.
        </p>
      </div>
      <button onClick={onVariant}>
        <Copy size={16} />
        Create a separate application version
      </button>
      <div className="form-grid section-space">
        <Field
          label="Target role"
          value={doc.application.role}
          onChange={(e) =>
            change((d) => {
              d.application.role = e.target.value;
            })
          }
        />
        <Field
          label="Employer"
          value={doc.application.company}
          onChange={(e) =>
            change((d) => {
              d.application.company = e.target.value;
            })
          }
        />
        <Field
          label="Application deadline"
          type="date"
          value={doc.application.deadline}
          onChange={(e) =>
            change((d) => {
              d.application.deadline = e.target.value;
            })
          }
        />
        <Select
          label="Requested file format"
          value={doc.application.requestedFormat}
          onChange={(v) =>
            change((d) => {
              d.application.requestedFormat =
                v as Resume["application"]["requestedFormat"];
            })
          }
        >
          <option value="pdf">PDF</option>
          <option value="docx">Word (DOCX)</option>
          <option value="either">Either / not specified</option>
        </Select>
        <Select
          label="Application status"
          value={doc.application.status}
          onChange={(v) =>
            change((d) => {
              d.application.status = v as Resume["application"]["status"];
            })
          }
        >
          {["Preparing", "Applied", "Interview", "Offer", "Closed"].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </Select>
      </div>
      <Area
        label="Job advertisement"
        rows={9}
        value={doc.application.jobAd}
        onChange={(e) =>
          change((d) => {
            d.application.jobAd = e.target.value;
          })
        }
        placeholder="Paste the role description and requirements here…"
        hint="Saved with this version. Never included in the résumé PDF."
      />
      <div className="tool-card">
        <div className="label-row">
          <h3>
            <Search size={18} />
            Role Lens
          </h3>
          <span className="tag">Local text check</span>
        </div>
        <p className="muted">
          Review useful terms from the advertisement. A missing term is a prompt
          to check your experience, not a reason to invent it.
        </p>
        {coverage.length ? (
          <>
            <div className="coverage-terms">
              {coverage.map((c) => (
                <span
                  key={c.term}
                  className={`term ${c.present ? "present" : "missing"}`}
                >
                  {c.present && <Check size={13} />}
                  <span>{c.term}</span>
                  <button
                    aria-label={`Ignore ${c.term}`}
                    title="Ignore this term"
                    onClick={() =>
                      change((d) => {
                        d.application.ignoredTerms.push(c.term);
                      })
                    }
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <small>
              Green: mentioned in the résumé · Outlined: review for relevance.
              This is not an ATS score or a prediction of hiring outcomes.
            </small>
          </>
        ) : (
          <p>Paste a job advertisement to see terms worth reviewing.</p>
        )}
        {!!doc.application.ignoredTerms.length && (
          <button
            className="text-button"
            onClick={() =>
              change((d) => {
                d.application.ignoredTerms = [];
              })
            }
          >
            Restore ignored terms
          </button>
        )}
      </div>
      <Area
        label="Application notes"
        value={doc.application.notes}
        onChange={(e) =>
          change((d) => {
            d.application.notes = e.target.value;
          })
        }
        placeholder="People to contact, application instructions or interview notes…"
      />
      {doc.application.deadline && (
        <p className="muted">
          The deadline is a local note. The app does not send background
          reminders.
        </p>
      )}
    </>
  );
}
export function LetterEditor({
  doc,
  change,
  onExport,
}: {
  doc: Resume;
  change: Change;
  onExport: (kind: DocumentKind) => void;
}) {
  const [tab, setTab] = useState<"letter" | "criteria">("letter");
  const set = (key: keyof Resume["coverLetter"], value: string) =>
    change((d) => {
      d.coverLetter[key] = value;
    });
  return (
    <>
      <div className="panel-title">
        <span className="eyebrow">The application pack</span>
        <h2>Tell the rest of your story.</h2>
        <p>
          A matching cover letter and a place to develop selection-criteria
          responses.
        </p>
      </div>
      <div className="segmented">
        <button
          className={tab === "letter" ? "active" : ""}
          onClick={() => setTab("letter")}
        >
          Cover letter
        </button>
        <button
          className={tab === "criteria" ? "active" : ""}
          onClick={() => setTab("criteria")}
        >
          Selection criteria
        </button>
      </div>
      {tab === "letter" ? (
        <>
          <div className="form-grid">
            <Field
              label="Date"
              value={doc.coverLetter.date}
              onChange={(e) => set("date", e.target.value)}
            />
            <Field
              label="Salutation"
              value={doc.coverLetter.salutation}
              onChange={(e) => set("salutation", e.target.value)}
            />
          </div>
          <Area
            label="Recipient / address (optional)"
            rows={3}
            value={doc.coverLetter.recipient}
            onChange={(e) => set("recipient", e.target.value)}
          />
          <Area
            label="Your letter"
            rows={16}
            value={doc.coverLetter.body}
            onChange={(e) => set("body", e.target.value)}
            hint="Use blank lines between paragraphs. Your contact details and chosen typography carry across."
            placeholder="Why this role? What relevant experience can you show? Why this organisation?"
          />
          <details className="help">
            <summary>A simple way to structure your letter</summary>
            <p>First paragraph: name the role and explain your interest.</p>
            <p>
              Middle paragraphs: give one or two relevant examples, with the
              contribution and outcome.
            </p>
            <p>
              Final paragraph: connect your experience to the organisation and
              invite a conversation.
            </p>
            <p>
              Use your own facts. A cover letter should add context to the
              résumé rather than repeat every bullet.
            </p>
          </details>
          <Field
            label="Closing"
            value={doc.coverLetter.closing}
            onChange={(e) => set("closing", e.target.value)}
          />
          <button
            className="primary"
            disabled={!doc.coverLetter.body.trim()}
            onClick={() => onExport("letter")}
          >
            Preview & download cover letter <ArrowRight size={16} />
          </button>
        </>
      ) : (
        <>
          <div className="notice">
            Use Situation, Task, Action and Result to organise evidence. Follow
            the employer’s word limit and requested format.
          </div>
          {doc.application.criteria.map((c, i) => (
            <div className="entry-card" key={c.id}>
              <div className="label-row">
                <h3>Response {i + 1}</h3>
                <button
                  className="icon-button danger-text"
                  aria-label={`Remove criterion ${i + 1}`}
                  onClick={() =>
                    change((d) => {
                      d.application.criteria = d.application.criteria.filter(
                        (x) => x.id !== c.id,
                      );
                    })
                  }
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <Area
                label="Criterion / question"
                rows={2}
                value={c.prompt}
                onChange={(e) =>
                  change((d) => {
                    d.application.criteria[i].prompt = e.target.value;
                  })
                }
              />
              {(["situation", "task", "action", "result"] as const).map(
                (key) => (
                  <Area
                    key={key}
                    label={key.charAt(0).toUpperCase() + key.slice(1)}
                    rows={3}
                    value={c[key]}
                    onChange={(e) =>
                      change((d) => {
                        d.application.criteria[i][key] = e.target.value;
                      })
                    }
                  />
                ),
              )}
              <small>
                {
                  [c.situation, c.task, c.action, c.result]
                    .join(" ")
                    .trim()
                    .split(/\s+/)
                    .filter(Boolean).length
                }{" "}
                words in this response
              </small>
            </div>
          ))}
          <div className="button-group">
            <button
              onClick={() =>
                change((d) => {
                  d.application.criteria.push({
                    id: uid(),
                    prompt: "",
                    situation: "",
                    task: "",
                    action: "",
                    result: "",
                  });
                })
              }
            >
              <Plus size={16} />
              Add criterion
            </button>
            <button
              className="primary"
              disabled={!doc.application.criteria.length}
              onClick={() => onExport("criteria")}
            >
              Preview & download responses
            </button>
          </div>
        </>
      )}
    </>
  );
}
export function CareerLibrary({
  doc,
  change,
  onClose,
  onMessage,
  temporary,
}: {
  doc: Resume;
  change: Change;
  onClose: () => void;
  onMessage: (m: string) => void;
  temporary: boolean;
}) {
  const [items, setItems] = useState<CareerItem[]>([]),
    [query, setQuery] = useState(""),
    [remove, setRemove] = useState<string | null>(null),
    [error, setError] = useState("");
  const refresh = () =>
    db.career
      .toArray()
      .then(setItems)
      .catch(() =>
        setError("The Career Library could not be opened on this device."),
      );
  useEffect(() => {
    void refresh();
  }, []);
  const add = (item: CareerItem) => {
    change((d) => {
      let s = d.sections.find((s) => s.type === item.type);
      if (!s) {
        s = newSection(item.type);
        s.entries = [];
        d.sections.push(s);
      }
      s.entries.push({ ...structuredClone(item.entry), id: uid() });
    });
    onMessage("Entry added to this résumé.");
  };
  const saveAll = async () => {
    try {
      const records: CareerItem[] = doc.sections.flatMap((s) =>
        s.entries
          .filter((e) => e.title || e.description || e.bullets.some(Boolean))
          .map((entry) => ({
            id: uid(),
            type: s.type,
            entry: structuredClone(entry),
            savedAt: new Date().toISOString(),
          })),
      );
      await db.career.bulkPut(records);
      await refresh();
      onMessage(`${records.length} entries saved to the Career Library.`);
    } catch {
      setError("Could not save these entries.");
    }
  };
  return (
    <Modal title="Your Career Library" onClose={onClose} wide>
      <p>
        Reusable entries for future applications. Adding one makes an
        independent copy in this résumé.
      </p>
      {error && <div className="notice error">{error}</div>}
      <div className="form-grid">
        <Field
          label="Find an entry"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Role, organisation or skill…"
        />
        <div className="align-end">
          <button disabled={temporary} onClick={() => void saveAll()}>
            <Bookmark size={16} />
            Save this résumé’s entries
          </button>
        </div>
      </div>
      {items.length ? (
        items
          .filter((i) =>
            JSON.stringify(i.entry).toLowerCase().includes(query.toLowerCase()),
          )
          .map((item) => (
            <div className="library-item" key={item.id}>
              <div>
                <span className="eyebrow">{sectionNames[item.type]}</span>
                <h3>
                  {item.entry.title ||
                    item.entry.description.slice(0, 60) ||
                    "Untitled entry"}
                </h3>
                <p>{item.entry.subtitle}</p>
              </div>
              <div className="button-group">
                <button onClick={() => add(item)}>
                  <Plus size={16} />
                  Add
                </button>
                <button
                  className="icon-button danger-text"
                  aria-label={`Delete ${item.entry.title || "library entry"}`}
                  onClick={() => setRemove(item.id)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))
      ) : (
        <Empty title="Your experience can work more than once.">
          <p>
            Save individual entries with the bookmark button in the editor, or
            save this résumé’s entries together.
          </p>
        </Empty>
      )}
      {remove && (
        <Confirm
          title="Delete this library entry?"
          onClose={() => setRemove(null)}
          onConfirm={() => {
            void db.career
              .delete(remove)
              .then(refresh)
              .catch(() => setError("Could not delete the entry."));
            setRemove(null);
          }}
        >
          Copies already added to résumés will remain there.
        </Confirm>
      )}
    </Modal>
  );
}
export function Versions({
  doc,
  onClose,
  onRestore,
  onVariant,
  onMessage,
  temporary,
}: {
  doc: Resume;
  onClose: () => void;
  onRestore: (d: Resume) => void;
  onVariant: () => void;
  onMessage: (m: string) => void;
  temporary: boolean;
}) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]),
    [selected, setSelected] = useState<Snapshot | null>(null),
    [label, setLabel] = useState(""),
    [error, setError] = useState("");
  const refresh = () =>
    db.snapshots
      .where("resumeId")
      .equals(doc.id)
      .reverse()
      .sortBy("createdAt")
      .then((list) => setSnapshots(list.reverse()))
      .catch(() => setError("Could not read saved snapshots."));
  useEffect(() => {
    void refresh();
  }, [doc.id]);
  const save = async () => {
    try {
      await createSnapshot(
        doc,
        label.trim() || `Snapshot · ${new Date().toLocaleDateString("en-AU")}`,
      );
      setLabel("");
      await refresh();
      onMessage("Snapshot saved.");
    } catch {
      setError(
        "Could not save this snapshot. Download a backup to keep your current version.",
      );
    }
  };
  const diff = selected ? snapshotDiff(selected.document, doc) : null;
  return (
    <Modal title="Versions & application snapshots" onClose={onClose} wide>
      <p>
        Keep an exact copy before a big edit or after submitting an application.
        The latest 30 snapshots per résumé are retained on this device.
      </p>
      {error && <div className="notice error">{error}</div>}
      <div className="form-grid">
        <Field
          label="Snapshot label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. Submitted to Example Company"
        />
        <div className="align-end">
          <button disabled={temporary} onClick={() => void save()}>
            <History size={16} />
            Save snapshot
          </button>
        </div>
      </div>
      <button className="text-button" onClick={onVariant}>
        <Copy size={16} />
        Create a separate résumé version
      </button>
      {snapshots.length ? (
        snapshots.map((s) => (
          <div key={s.id} className="library-item">
            <div>
              <h3>{s.label}</h3>
              <small>
                {new Date(s.createdAt).toLocaleString("en-AU")}{" "}
                {s.document.application.company &&
                  `· ${s.document.application.company}`}
              </small>
            </div>
            <button
              onClick={() => setSelected(selected?.id === s.id ? null : s)}
            >
              Compare with current
            </button>
          </div>
        ))
      ) : (
        <Empty title="Keep a moment in your career story.">
          <p>Your snapshots will appear here.</p>
        </Empty>
      )}
      {selected && diff && (
        <div className="diff">
          <h3>Changes since “{selected.label}”</h3>
          {!diff.added.length &&
            !diff.removed.length &&
            !diff.designChanged &&
            !diff.applicationChanged &&
            !diff.letterChanged &&
            !diff.orderChanged && <p>No content or design changes.</p>}
          {diff.removed.map((t, i) => (
            <p key={`r${i}`} className="removed">
              − {t}
            </p>
          ))}
          {diff.added.map((t, i) => (
            <p key={`a${i}`} className="added">
              + {t}
            </p>
          ))}
          {!diff.added.length && !diff.removed.length && diff.orderChanged && (
            <p>Content order changed.</p>
          )}
          {diff.designChanged && <p>Template or layout settings changed.</p>}
          {diff.applicationChanged && <p>Application details changed.</p>}
          {diff.letterChanged && <p>Cover letter changed.</p>}
          <button
            onClick={() => {
              onRestore(selected.document);
              onClose();
            }}
          >
            Restore as a new résumé
          </button>
        </div>
      )}
    </Modal>
  );
}
