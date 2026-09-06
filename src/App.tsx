import { lazy, Suspense, useEffect, useRef, useState } from "react";
import {
  FileText,
  Plus,
  Upload,
  ArrowRight,
  ArrowLeft,
  Settings as SettingsIcon,
  Download,
  Copy,
  Trash2,
  Undo2,
  Redo2,
  Palette,
  UserRound,
  BriefcaseBusiness,
  GraduationCap,
  BookOpen,
  Layers,
  Mail,
  Target,
  History,
  Bookmark,
  ArrowUp,
  ArrowDown,
  Eye,
  PenLine,
  Check,
  ChevronDown,
  X,
} from "lucide-react";
import { useWorkspace } from "./useWorkspace";
import {
  newResume,
  sampleResume,
  duplicateResume,
  newSection,
  sectionTypes,
  sectionNames,
  templates,
  uid,
  type Resume,
  type SectionType,
} from "./model";
import {
  db,
  parseBackup,
  restoreBackup,
  exportBackup,
  downloadJSON,
  removeResume,
  createSnapshot,
} from "./storage";
import { Modal, Field, Select, Area, Confirm, Loading } from "./ui";
import { ProfileEditor, SectionEditor, TemplateEditor } from "./EditorForms";
import {
  TailorEditor,
  LetterEditor,
  CareerLibrary,
  Versions,
} from "./ToolsPanel";
import type { DocumentKind } from "./document";
import { isOfflineEnabled, enableOffline } from "./offline";
const ImportDialog = lazy(() => import("./ImportDialog"));
const Settings = lazy(() => import("./Settings"));
const LivePreview = lazy(() =>
  import("./PreviewPanel").then((m) => ({ default: m.LivePreview })),
);
const ExportDialog = lazy(() =>
  import("./PreviewPanel").then((m) => ({ default: m.ExportDialog })),
);

export default function App() {
  const ws = useWorkspace();
  const d = ws.draft;
  const [section, setSection] = useState("profile"),
    [mobileTab, setMobileTab] = useState("edit"),
    [modal, setModal] = useState<
      | "new"
      | "import"
      | "paste"
      | "settings"
      | "add-section"
      | "library"
      | "versions"
      | null
    >(null),
    [exportKind, setExportKind] = useState<DocumentKind | null>(null),
    [deleteId, setDeleteId] = useState<string | null>(null),
    [deleteSection, setDeleteSection] = useState<string | null>(null),
    [toast, setToast] = useState(""),
    [stage, setStage] = useState("experienced"),
    [newTitle, setNewTitle] = useState(""),
    [newRole, setNewRole] = useState(""),
    [filter, setFilter] = useState(""),
    [update, setUpdate] = useState<ServiceWorkerRegistration | null>(null),
    [online, setOnline] = useState(navigator.onLine);
  const backupInput = useRef<HTMLInputElement>(null);
  const initial = useRef(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const notify = (message: string) => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 6500);
  };
  const handle = (promise: Promise<unknown>) =>
    void promise.catch((e) =>
      notify(
        (e as Error).message ||
          "Something went wrong. Your current draft is still open.",
      ),
    );
  useEffect(() => {
    if (ws.ready && !initial.current) {
      initial.current = true;
      const id = location.hash.match(/^#\/editor\/([^/]+)$/)?.[1];
      const existing = ws.documents.find((x) => x.id === id);
      if (existing) handle(ws.open(existing));
    }
  }, [ws.ready]);
  useEffect(() => {
    const onHash = () => {
      const id = location.hash.match(/^#\/editor\/([^/]+)$/)?.[1];
      if (id === d?.id) return;
      if (id) {
        const found = ws.documents.find((x) => x.id === id);
        if (found) handle(ws.open(found));
      } else if (d) handle(ws.home());
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [d?.id, ws.documents]);
  useEffect(() => {
    const yes = () => setOnline(true),
      no = () => setOnline(false);
    window.addEventListener("online", yes);
    window.addEventListener("offline", no);
    return () => {
      window.removeEventListener("online", yes);
      window.removeEventListener("offline", no);
    };
  }, []);
  useEffect(() => {
    if (!isOfflineEnabled() || import.meta.env.DEV) return;
    void enableOffline()
      .then((reg) => {
        if (reg.waiting) setUpdate(reg);
        reg.addEventListener("updatefound", () => {
          const installing = reg.installing;
          installing?.addEventListener("statechange", () => {
            if (
              installing.state === "installed" &&
              navigator.serviceWorker.controller
            )
              setUpdate(reg);
          });
        });
        void reg.update();
      })
      .catch(() => {});
  }, []);
  const newDoc = async (doc: Resume) => {
    await ws.open(doc, true);
    setSection("profile");
    setMobileTab("edit");
  };
  const variant = async () => {
    if (!d) return;
    await ws.save();
    await newDoc(duplicateResume(d, "application version"));
    setModal(null);
    setSection("tailor");
    notify("A separate application version is ready.");
  };
  const backup = async () => {
    try {
      let bundle;
      try {
        bundle = await exportBackup(d || undefined);
        if (ws.temporary)
          bundle.documents = ws.documents
            .map((x) => (d?.id === x.id ? d : x))
            .concat(d && !ws.documents.some((x) => x.id === d.id) ? [d] : []);
      } catch {
        bundle = {
          kind: "resume-studio-backup",
          version: 1,
          exportedAt: new Date().toISOString(),
          documents: d ? [d] : ws.documents,
          snapshots: [],
          career: [],
        };
      }
      downloadJSON(
        bundle,
        `Resume-Studio-Backup_${new Date().toISOString().slice(0, 10)}.json`,
      );
      notify("Editable backup downloaded. Keep it somewhere you trust.");
    } catch (e) {
      notify((e as Error).message);
    }
  };
  const restore = async (file: File) => {
    if (ws.temporary)
      throw new Error(
        "Turn off Temporary session in settings before restoring a workspace backup.",
      );
    if (file.size > 15_000_000) throw new Error("Choose a backup under 15 MB.");
    const backup = parseBackup(await file.text());
    await ws.save();
    const docs = await restoreBackup(backup);
    await ws.refresh();
    notify(`Restored ${docs.length} résumés as separate copies.`);
  };
  const downloaded = (label: string) => {
    if (d && !ws.temporary)
      void createSnapshot(d, label).catch(() =>
        notify("Download completed. The local snapshot could not be saved."),
      );
  };
  const active = d?.sections.find((s) => s.id === section);
  const navigate = (id: string) => {
    setSection(id);
    setMobileTab("edit");
    document.querySelector(".editor-panel")?.scrollTo({ top: 0 });
  };
  if (!ws.ready)
    return (
      <div className="initial-loading">
        <FileText size={32} />
        <p>Opening Resume Studio…</p>
      </div>
    );
  return (
    <>
      <a
        href="#main-content"
        className="skip-link"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main-content")?.focus();
        }}
      >
        Skip to content
      </a>
      <header className="app-header">
        <button
          className="brand"
          aria-label="Resume Studio home"
          onClick={() => handle(ws.home())}
        >
          <span className="brand-mark">
            <FileText size={23} />
          </span>
          <span>
            resume<span className="brand-light">studio</span>
            <small>BY CHAI</small>
          </span>
        </button>
        <div className="header-right">
          {!online && <span className="tag">Offline</span>}
          <span className="private-label">
            <span className="privacy-dot" />
            Made for your next chapter
          </span>
          <button
            className="icon-button"
            aria-label="Settings and backup"
            onClick={() => setModal("settings")}
          >
            <SettingsIcon size={20} />
          </button>
        </div>
      </header>
      {update && (
        <div className="update-banner">
          <span>A new version is ready. Save your work, then update.</span>
          <button
            onClick={() =>
              handle(
                (async () => {
                  await ws.save();
                  if (ws.temporary) await backup();
                  const waiting = update.waiting;
                  if (!waiting) return;
                  navigator.serviceWorker.addEventListener(
                    "controllerchange",
                    () => location.reload(),
                    { once: true },
                  );
                  waiting.postMessage({ type: "SKIP_WAITING" });
                })(),
              )
            }
          >
            Save & update
          </button>
        </div>
      )}
      {ws.error && (
        <div className="save-error" role="alert">
          <p>{ws.error}</p>
          <button onClick={() => void backup()}>
            <Download size={15} />
            Download backup
          </button>
          {d && (
            <button onClick={() => handle(ws.recover())}>
              Keep edits as a new copy
            </button>
          )}
        </div>
      )}
      {!d ? (
        <main id="main-content" tabIndex={-1} className="workspace">
          <div className="workspace-intro">
            <div>
              <span className="eyebrow">
                Australian résumés. Thoughtfully made.
              </span>
              <h1>
                Your experience.
                <br />
                <em>A clear next step.</em>
              </h1>
              <p>
                Bring your story together. Start fresh or pick up where you left
                off.
              </p>
            </div>
            <div className="workspace-note">
              <span className="note-line" />
              <p>
                A good résumé makes room
                <br />
                for what matters.
              </p>
              <small>Simple templates · A4 · No watermark</small>
            </div>
          </div>
          <div className="start-options">
            <button
              className="start-card primary-start"
              onClick={() => {
                setNewTitle("");
                setNewRole("");
                setModal("new");
              }}
            >
              <span className="start-icon">
                <Plus size={24} />
              </span>
              <strong>Create a résumé</strong>
              <span>Build your next chapter, one section at a time.</span>
              <ArrowRight size={20} />
            </button>
            <button className="start-card" onClick={() => setModal("import")}>
              <span className="start-icon">
                <Upload size={24} />
              </span>
              <strong>Import a résumé</strong>
              <span>Bring a PDF, Word document or scan.</span>
              <ArrowRight size={20} />
            </button>
            <button className="start-card" onClick={() => setModal("paste")}>
              <span className="start-icon">
                <PenLine size={24} />
              </span>
              <strong>Start with your words</strong>
              <span>Paste existing text and make it your own.</span>
              <ArrowRight size={20} />
            </button>
          </div>
          <div className="workspace-section-head">
            <div>
              <span className="eyebrow">Your workspace</span>
              <h2>
                {ws.documents.length
                  ? "Pick up your story."
                  : "Room for your first résumé."}
              </h2>
            </div>
            {ws.documents.length > 2 && (
              <input
                aria-label="Search résumés"
                className="search-input"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Find a résumé…"
              />
            )}
            <button
              className="text-button"
              onClick={() => handle(newDoc(sampleResume()))}
            >
              Explore an example <ArrowRight size={16} />
            </button>
          </div>
          {ws.documents.length ? (
            <div className="document-grid">
              {ws.documents
                .filter((doc) =>
                  [doc.title, doc.application.role, doc.application.company]
                    .join(" ")
                    .toLowerCase()
                    .includes(filter.toLowerCase()),
                )
                .map((doc) => (
                  <article key={doc.id} className="document-card">
                    <button
                      className="document-open"
                      onClick={() => handle(ws.open(doc))}
                    >
                      <div
                        className="document-thumbnail"
                        style={{ borderTopColor: doc.design.accent }}
                      >
                        <strong>{doc.profile.name || "Your name"}</strong>
                        <span>
                          {doc.profile.headline || "A résumé in progress"}
                        </span>
                        <hr />
                        {doc.sections
                          .filter((s) => !s.hidden)
                          .slice(0, 3)
                          .map((s) => (
                            <div key={s.id}>
                              <b>{s.title}</b>
                              <p>
                                {s.entries[0]?.title ||
                                  "Your experience belongs here."}
                              </p>
                            </div>
                          ))}
                      </div>
                      <h3>{doc.title}</h3>
                      <p>
                        {doc.application.company ||
                          templates.find((t) => t.id === doc.design.template)
                            ?.name}{" "}
                        · {doc.application.status}
                      </p>
                      <small>
                        Edited{" "}
                        {new Date(doc.updatedAt).toLocaleDateString("en-AU", {
                          day: "numeric",
                          month: "short",
                        })}
                      </small>
                    </button>
                    <div className="document-actions">
                      <button
                        className="text-button"
                        onClick={() => handle(newDoc(duplicateResume(doc)))}
                      >
                        <Copy size={15} />
                        Duplicate
                      </button>
                      <button
                        className="icon-button danger-text"
                        aria-label={`Delete ${doc.title}`}
                        onClick={() => setDeleteId(doc.id)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </article>
                ))}
            </div>
          ) : (
            <div className="workspace-empty">
              <div className="empty-symbol">
                <FileText size={24} />
              </div>
              <div>
                <h3>Your drafts will feel at home here.</h3>
                <p>
                  Saved in this browser. Download an editable backup whenever
                  you want to move devices.
                </p>
              </div>
              <button onClick={() => backupInput.current?.click()}>
                Restore a backup
              </button>
            </div>
          )}
          <div className="template-teaser">
            <div>
              <span className="eyebrow">Five ways to make an impression</span>
              <h2>
                Subtle templates.
                <br />
                Substantial experience.
              </h2>
              <p>Choose the typography and spacing that suit your story.</p>
            </div>
            <div className="template-samples">
              {templates.slice(0, 3).map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    const doc = newResume();
                    doc.design.template = t.id;
                    doc.design.accent = t.accent;
                    doc.design.font = t.font;
                    handle(newDoc(doc));
                  }}
                >
                  <div
                    className={`mini-page ${t.id}`}
                    style={{ color: t.accent }}
                  >
                    <strong
                      style={{
                        fontFamily:
                          t.font === "Source Serif" ? "Georgia" : "inherit",
                      }}
                    >
                      Your name
                    </strong>
                    <span>A clear next step</span>
                    <hr />
                    <b>Experience</b>
                    <i />
                    <i />
                    <i className="short" />
                    <b>Education</b>
                    <i />
                    <i />
                  </div>
                  <span>
                    {t.name} <ArrowRight size={13} />
                  </span>
                </button>
              ))}
            </div>
          </div>
          <footer className="workspace-footer">
            <span>Made with care, by Chai.</span>
            <button
              className="text-button"
              onClick={() => setModal("settings")}
            >
              Privacy & your data
            </button>
            <a
              href="https://github.com/chaishah/Resume-Builder"
              target="_blank"
              rel="noreferrer"
            >
              View the project
            </a>
          </footer>
        </main>
      ) : (
        <>
          <div className="document-toolbar">
            <div className="document-title-group">
              <button
                className="icon-button"
                aria-label="Back to workspace"
                onClick={() => handle(ws.home())}
              >
                <ArrowLeft size={19} />
              </button>
              <div>
                <input
                  className="document-title-input"
                  aria-label="Résumé name"
                  value={d.title}
                  onChange={(e) =>
                    ws.change((doc) => {
                      doc.title = e.target.value;
                    })
                  }
                />
                <span
                  className={`save-status ${ws.status === "Not saved" || ws.status === "Conflicting edits" ? "error-text" : ""}`}
                  role="status"
                >
                  {ws.status === "Saved on this device" && <Check size={12} />}{" "}
                  {ws.status}
                </span>
              </div>
            </div>
            <div className="toolbar-actions">
              <button
                className="icon-button"
                disabled={!ws.canUndo}
                aria-label="Undo edit"
                onClick={ws.undo}
              >
                <Undo2 size={18} />
              </button>
              <button
                className="icon-button"
                disabled={!ws.canRedo}
                aria-label="Redo edit"
                onClick={ws.redo}
              >
                <Redo2 size={18} />
              </button>
              <button className="toolbar-backup" onClick={() => void backup()}>
                <Download size={16} />
                Backup
              </button>
              <button
                className="primary"
                onClick={() => setExportKind("resume")}
              >
                <Download size={16} />
                <span>Download</span>
              </button>
            </div>
          </div>
          <div className="mobile-tabs">
            <button
              className={mobileTab === "edit" ? "active" : ""}
              onClick={() => setMobileTab("edit")}
            >
              <PenLine size={16} />
              Edit
            </button>
            <button
              className={mobileTab === "preview" ? "active" : ""}
              onClick={() => setMobileTab("preview")}
            >
              <Eye size={16} />
              Preview
            </button>
          </div>
          <div className={`editor-layout mobile-${mobileTab}`}>
            <nav className="section-nav" aria-label="Résumé sections">
              <span className="nav-label">YOUR RÉSUMÉ</span>
              <button
                className={section === "profile" ? "active" : ""}
                onClick={() => navigate("profile")}
              >
                <UserRound size={18} />
                Contact & summary
              </button>
              {d.sections.map((s, i) => (
                <div className="section-nav-row" key={s.id}>
                  <button
                    className={section === s.id ? "active" : ""}
                    onClick={() => navigate(s.id)}
                  >
                    {s.type === "experience" ? (
                      <BriefcaseBusiness size={17} />
                    ) : s.type === "education" ? (
                      <GraduationCap size={17} />
                    ) : (
                      <Layers size={17} />
                    )}
                    <span>
                      {s.title}
                      {s.hidden ? " · hidden" : ""}
                    </span>
                  </button>
                  {section === s.id && (
                    <div className="section-nav-actions">
                      <button
                        aria-label="Move section up"
                        disabled={i === 0}
                        onClick={() =>
                          ws.change((doc) => {
                            [doc.sections[i - 1], doc.sections[i]] = [
                              doc.sections[i],
                              doc.sections[i - 1],
                            ];
                          })
                        }
                      >
                        <ArrowUp size={13} />
                      </button>
                      <button
                        aria-label="Move section down"
                        disabled={i === d.sections.length - 1}
                        onClick={() =>
                          ws.change((doc) => {
                            [doc.sections[i], doc.sections[i + 1]] = [
                              doc.sections[i + 1],
                              doc.sections[i],
                            ];
                          })
                        }
                      >
                        <ArrowDown size={13} />
                      </button>
                      <button
                        aria-label="Delete section"
                        onClick={() => setDeleteSection(s.id)}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
              <button
                className="add-section"
                onClick={() => setModal("add-section")}
              >
                <Plus size={17} />
                Add section
              </button>
              {!!d.importNotes && (
                <button
                  className={section === "import-notes" ? "active" : ""}
                  onClick={() => navigate("import-notes")}
                >
                  <BookOpen size={17} />
                  Import notes
                </button>
              )}
              <span className="nav-label">MAKE IT YOURS</span>
              <button
                className={section === "design" ? "active" : ""}
                onClick={() => navigate("design")}
              >
                <Palette size={18} />
                Templates & layout
              </button>
              <button
                className={section === "tailor" ? "active" : ""}
                onClick={() => navigate("tailor")}
              >
                <Target size={18} />
                Tailor to a role
              </button>
              <button
                className={section === "letter" ? "active" : ""}
                onClick={() => navigate("letter")}
              >
                <Mail size={18} />
                Application pack
              </button>
              <button onClick={() => setModal("library")}>
                <Bookmark size={18} />
                Career Library
              </button>
              <button onClick={() => setModal("versions")}>
                <History size={18} />
                Versions & snapshots
              </button>
              <div className="nav-foot">
                <p>A little clarity goes a long way.</p>
                <small>Your next chapter starts here.</small>
              </div>
            </nav>
            <main id="main-content" tabIndex={-1} className="editor-panel">
              {section === "profile" ? (
                <ProfileEditor doc={d} change={ws.change} />
              ) : section === "design" ? (
                <TemplateEditor doc={d} change={ws.change} />
              ) : section === "tailor" ? (
                <TailorEditor
                  doc={d}
                  change={ws.change}
                  onVariant={() => handle(variant())}
                />
              ) : section === "letter" ? (
                <LetterEditor
                  doc={d}
                  change={ws.change}
                  onExport={setExportKind}
                />
              ) : section === "import-notes" ? (
                <>
                  <div className="panel-title">
                    <span className="eyebrow">Keep every useful detail</span>
                    <h2>Finish the import.</h2>
                    <p>
                      This text could not be confidently assigned. Copy useful
                      details into the relevant fields, then remove them from
                      these notes.
                    </p>
                  </div>
                  <Area
                    label="Unassigned import text"
                    rows={22}
                    value={d.importNotes}
                    onChange={(e) =>
                      ws.change((doc) => {
                        doc.importNotes = e.target.value;
                      })
                    }
                  />
                  <p className="muted">
                    These notes are saved in your backup and excluded from
                    exported applications.
                  </p>
                </>
              ) : active ? (
                <SectionEditor
                  key={active.id}
                  section={active}
                  change={ws.change}
                  onMessage={notify}
                  temporary={ws.temporary}
                />
              ) : (
                <ProfileEditor doc={d} change={ws.change} />
              )}
            </main>
            <Suspense
              fallback={
                <div className="live-preview">
                  <Loading>Opening preview…</Loading>
                </div>
              }
            >
              <LivePreview doc={d} onExport={() => setExportKind("resume")} />
            </Suspense>
          </div>
        </>
      )}
      <input
        ref={backupInput}
        hidden
        type="file"
        accept=".json"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handle(restore(file));
          e.target.value = "";
        }}
      />
      <Suspense
        fallback={
          <div className="floating-loading">
            <Loading>Opening…</Loading>
          </div>
        }
      >
        {(modal === "import" || modal === "paste") && (
          <ImportDialog
            onClose={() => setModal(null)}
            onImport={newDoc}
            onBackup={restore}
            startPaste={modal === "paste"}
          />
        )}
        {modal === "settings" && (
          <Settings
            onClose={() => setModal(null)}
            onBackup={() => void backup()}
            onRestore={() => backupInput.current?.click()}
            temporary={ws.temporary}
            onTemporary={async (value) => {
              await ws.save();
              ws.setTemporary(value);
            }}
          />
        )}
        {d && exportKind && (
          <ExportDialog
            doc={d}
            kind={exportKind}
            onClose={() => setExportKind(null)}
            onDownloaded={downloaded}
          />
        )}
      </Suspense>
      {modal === "new" && (
        <Modal title="A fresh start." onClose={() => setModal(null)}>
          <p>Give this résumé a name. You can change everything later.</p>
          <Field
            label="Résumé name"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="e.g. My next opportunity"
          />
          <Field
            label="Target role (optional)"
            value={newRole}
            onChange={(e) => setNewRole(e.target.value)}
            placeholder="What’s your next chapter?"
          />
          <Select
            label="Where are you in your career?"
            value={stage}
            onChange={setStage}
          >
            <option value="experienced">Building on my experience</option>
            <option value="graduate">Starting out / graduating</option>
            <option value="change">Changing careers</option>
            <option value="returning">Returning to work</option>
          </Select>
          <div className="modal-actions">
            <button onClick={() => setModal(null)}>Cancel</button>
            <button
              className="primary"
              onClick={() => {
                const doc = newResume(stage);
                doc.title = newTitle.trim() || "My next opportunity";
                doc.application.role = newRole;
                handle(newDoc(doc).then(() => setModal(null)));
              }}
            >
              Create résumé <ArrowRight size={16} />
            </button>
          </div>
        </Modal>
      )}
      {d && modal === "add-section" && (
        <Modal
          title="Make room for your experience."
          onClose={() => setModal(null)}
        >
          <div className="section-picker">
            {sectionTypes.map((type) => (
              <button
                key={type}
                onClick={() => {
                  const s = newSection(type);
                  ws.change((doc) => {
                    doc.sections.push(s);
                  });
                  navigate(s.id);
                  setModal(null);
                }}
              >
                <Plus size={17} />
                {sectionNames[type]}
              </button>
            ))}
          </div>
        </Modal>
      )}
      {d && modal === "library" && (
        <CareerLibrary
          doc={d}
          change={ws.change}
          onClose={() => setModal(null)}
          onMessage={notify}
          temporary={ws.temporary}
        />
      )}
      {d && modal === "versions" && (
        <Versions
          doc={d}
          onClose={() => setModal(null)}
          onMessage={notify}
          temporary={ws.temporary}
          onRestore={(old) =>
            handle(newDoc(duplicateResume(old, "restored snapshot")))
          }
          onVariant={() => handle(variant())}
        />
      )}
      {deleteId && (
        <Confirm
          title="Delete this résumé?"
          onClose={() => setDeleteId(null)}
          onConfirm={() => {
            handle(ws.remove(deleteId));
            setDeleteId(null);
          }}
        >
          This removes the résumé and its snapshots from this device. Download a
          backup first if you want to keep them.
        </Confirm>
      )}
      {deleteSection && d && (
        <Confirm
          title="Delete this section?"
          onClose={() => setDeleteSection(null)}
          onConfirm={() => {
            if (!ws.temporary)
              void createSnapshot(d, "Before removing a section").catch(
                () => {},
              );
            ws.change((doc) => {
              doc.sections = doc.sections.filter((s) => s.id !== deleteSection);
            });
            setSection("profile");
            setDeleteSection(null);
          }}
        >
          The entries in this section will be removed. You can undo the change
          while this résumé is open.
        </Confirm>
      )}
      {toast && (
        <div className="toast" role="status">
          <span>{toast}</span>
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </>
  );
}
