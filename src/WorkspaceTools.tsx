import { useEffect, useState } from "react";
import { ArrowRight, Plus, Copy, Bookmark, Trash2 } from "lucide-react";
import { Modal, Field, Select, Confirm } from "./ui";
import { db } from "./storage";
import { uid, safeLink, type Resume, type TemplatePreset } from "./model";
import type { Change } from "./EditorForms";
import {
  applyPreset,
  compareResumes,
  deadlineLabel,
  newApplication,
} from "./features";
export function PresetManager({
  doc,
  change,
  temporary,
}: {
  doc: Resume;
  change: Change;
  temporary: boolean;
}) {
  const [presets, setPresets] = useState<TemplatePreset[]>([]),
    [name, setName] = useState(""),
    [message, setMessage] = useState(""),
    [remove, setRemove] = useState<string | null>(null);
  useEffect(() => {
    void db.presets
      .toArray()
      .then(setPresets)
      .catch(() =>
        setMessage("Saved presets are unavailable in this session."),
      );
  }, []);
  const save = async () => {
    try {
      if (!name.trim()) return;
      if (presets.length >= 100)
        throw new Error(
          "You can keep up to 100 presets. Remove one before saving another.",
        );
      const p: TemplatePreset = {
        id: uid(),
        name: name.trim().slice(0, 100),
        design: structuredClone(doc.design),
        sectionOrder: doc.sections.map((s) => s.type),
        savedAt: new Date().toISOString(),
      };
      await db.presets.add(p);
      setPresets((prev) => [p, ...prev]);
      setName("");
      setMessage("Preset saved. It is included in your workspace backup.");
    } catch (e) {
      setMessage((e as Error).message);
    }
  };
  return (
    <details className="tool-card preset-manager">
      <summary>
        <Bookmark size={16} />
        Your template presets
      </summary>
      <p>
        Save the current typography, margins, colour, spacing and section order.
        Applying a preset keeps every entry.
      </p>
      <div className="preset-save">
        <Field
          label="Preset name"
          maxLength={100}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. My clean two-page layout"
        />
        <button
          disabled={temporary || !name.trim()}
          onClick={() => void save()}
        >
          Save current layout
        </button>
      </div>
      {temporary && (
        <p className="muted">
          Turn off Temporary session to save presets on this device.
        </p>
      )}
      {message && <p role="status">{message}</p>}
      {presets.map((p) => (
        <div className="preset-row" key={p.id}>
          <span>
            <strong>{p.name}</strong>
            <small>
              {p.design.font} · {p.design.fontSize} pt · {p.design.spacing}
            </small>
          </span>
          <button
            onClick={() => {
              change((d) => applyPreset(d, p));
              setMessage(`Applied ${p.name}. Use Undo to revert.`);
            }}
          >
            Apply
          </button>
          <button
            className="icon-button"
            disabled={temporary}
            aria-label={`Delete preset ${p.name}`}
            onClick={() => setRemove(p.id)}
          >
            <Trash2 size={16} />
          </button>
        </div>
      ))}
      {remove && (
        <Confirm
          title="Delete this preset?"
          onClose={() => setRemove(null)}
          onConfirm={() => {
            void db.presets
              .delete(remove)
              .then(() =>
                setPresets((prev) => prev.filter((p) => p.id !== remove)),
              )
              .catch(() => setMessage("The preset could not be deleted."));
            setRemove(null);
          }}
        >
          Résumés using this layout will keep their current appearance.
        </Confirm>
      )}
    </details>
  );
}
export function CompareVersions({
  doc,
  documents,
  onClose,
}: {
  doc: Resume;
  documents: Resume[];
  onClose: () => void;
}) {
  const choices = documents.filter((d) => d.id !== doc.id),
    [selected, setSelected] = useState(doc.parentId || choices[0]?.id || "");
  const base = choices.find((d) => d.id === selected),
    diff = base ? compareResumes(base, doc) : [];
  return (
    <Modal title="Compare résumé versions" onClose={onClose} wide>
      <p>
        Compare this draft with your master résumé or another application
        version. All changes below are read-only.
      </p>
      <Select label="Compare from" value={selected} onChange={setSelected}>
        <option value="">Choose a résumé</option>
        {choices.map((d) => (
          <option value={d.id} key={d.id}>
            {d.title}
          </option>
        ))}
      </Select>
      <p>
        Comparing with <strong>{doc.title}</strong>
      </p>
      {!choices.length && (
        <p>
          Create an application version first to compare it with your original
          résumé.
        </p>
      )}
      {base && (
        <>
          <p className="tag">{diff.length} changed fields</p>
          {!diff.length && (
            <p>No differences in the compared content or layout.</p>
          )}
          <div className="comparison-grid">
            {diff.map((row, i) => (
              <section className="comparison-row" key={i}>
                <h3>{row.label}</h3>
                <div>
                  <span className="eyebrow">{base.title}</span>
                  <pre className="removed">{row.before || "(empty)"}</pre>
                </div>
                <div>
                  <span className="eyebrow">{doc.title}</span>
                  <pre className="added">{row.after || "(empty)"}</pre>
                </div>
              </section>
            ))}
          </div>
        </>
      )}
    </Modal>
  );
}
export function ApplicationTracker({
  documents,
  onOpen,
  onUpdate,
  onCreate,
}: {
  documents: Resume[];
  onOpen: (d: Resume) => void;
  onUpdate: (
    d: Resume,
    status: Resume["application"]["status"],
  ) => Promise<void>;
  onCreate: (d: Resume) => Promise<void>;
}) {
  const [status, setStatus] = useState("All"),
    [search, setSearch] = useState(""),
    [adding, setAdding] = useState(false),
    [base, setBase] = useState(""),
    [company, setCompany] = useState(""),
    [role, setRole] = useState(""),
    [link, setLink] = useState(""),
    [deadline, setDeadline] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState("");
  const apps = documents.filter(
      (d) =>
        d.application.role || d.application.company || d.application.jobUrl,
    ),
    statuses = [
      "Preparing",
      "Applied",
      "Interview",
      "Offer",
      "Closed",
    ] as const;
  const filtered = apps
    .filter(
      (d) =>
        (status === "All" || d.application.status === status) &&
        `${d.title} ${d.application.company} ${d.application.role}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    )
    .sort((a, b) =>
      (a.application.deadline || "9999").localeCompare(
        b.application.deadline || "9999",
      ),
    );
  return (
    <section className="application-tracker">
      <div className="label-row">
        <div>
          <span className="eyebrow">Your next opportunities</span>
          <h2>Application tracker</h2>
        </div>
        <button className="primary" onClick={() => setAdding(true)}>
          <Plus size={16} />
          Track an application
        </button>
      </div>
      <p className="muted">
        Each application is linked to its own résumé. Deadlines and status stay
        on this device and travel with your backup.
      </p>
      <div className="tracker-filters">
        <Select label="Application status" value={status} onChange={setStatus}>
          <option>All</option>
          {statuses.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </Select>
        <Field
          label="Search applications"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Employer, role or résumé"
        />
      </div>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      <div className="tracker-list">
        {filtered.map((d) => {
          const url = safeLink(d.application.jobUrl),
            due = deadlineLabel(d.application.deadline);
          return (
            <article className="tracker-card" key={d.id}>
              <div>
                <span className="eyebrow">
                  {d.application.company || "Employer not added"}
                </span>
                <h3>{d.application.role || d.title}</h3>
                <p className="muted">Résumé: {d.title}</p>
                {d.application.deadline && (
                  <p>
                    <time dateTime={d.application.deadline}>
                      {new Date(
                        `${d.application.deadline}T12:00:00`,
                      ).toLocaleDateString("en-AU")}
                    </time>
                    {d.application.status === "Preparing" && due && (
                      <span className="tag">{due}</span>
                    )}
                  </p>
                )}
                {url && /^https?:/.test(url) && (
                  <a href={url} target="_blank" rel="noopener noreferrer">
                    View job advertisement
                  </a>
                )}
              </div>
              <div className="tracker-actions">
                <Select
                  label={`Status for ${d.title}`}
                  value={d.application.status}
                  onChange={(value) => {
                    if (busy) return;
                    setBusy(d.id);
                    setError("");
                    void onUpdate(d, value as Resume["application"]["status"])
                      .catch((e) => setError((e as Error).message))
                      .finally(() => setBusy(""));
                  }}
                >
                  {statuses.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </Select>
                <button disabled={busy === d.id} onClick={() => onOpen(d)}>
                  Open résumé <ArrowRight size={16} />
                </button>
              </div>
            </article>
          );
        })}
      </div>
      {!filtered.length && (
        <div className="empty">
          <h3>
            {apps.length
              ? "No applications match these filters."
              : "Keep your job search together."}
          </h3>
          <p>
            Track an application using a copy of an existing résumé or start
            from a blank draft.
          </p>
        </div>
      )}
      {adding && (
        <Modal title="Track a new application" onClose={() => setAdding(false)}>
          <p>
            Your original résumé stays available. This creates a separate
            application version.
          </p>
          <Select label="Start from" value={base} onChange={setBase}>
            <option value="">A blank résumé</option>
            {documents.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title}
              </option>
            ))}
          </Select>
          <Field
            label="Employer"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
          />
          <Field
            label="Role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          />
          <Field
            label="Job advertisement link"
            type="url"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://…"
          />
          <Field
            label="Closing date"
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            onInput={(e) => setDeadline(e.currentTarget.value)}
            onBlur={(e) => setDeadline(e.currentTarget.value)}
          />
          {error && <p role="alert">{error}</p>}
          <div className="modal-actions">
            <button onClick={() => setAdding(false)}>Cancel</button>
            <button
              className="primary"
              disabled={!company.trim() || !role.trim() || busy === "new"}
              onClick={() => {
                setBusy("new");
                void onCreate(
                  newApplication(
                    documents.find((d) => d.id === base),
                    {
                      company: company.trim(),
                      role: role.trim(),
                      jobUrl: link.trim(),
                      deadline,
                    },
                  ),
                )
                  .then(() => setAdding(false))
                  .catch((e) => setError((e as Error).message))
                  .finally(() => setBusy(""));
              }}
            >
              <Copy size={16} />
              Create application version
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
