import { useState, useRef, useEffect, useCallback } from "react";
import { type Resume, duplicateResume } from "./model";
import { db, saveResume, removeResume, ConflictError } from "./storage";
const fingerprint = (d: Resume) =>
  JSON.stringify({ ...d, revision: 0, updatedAt: "" });
export function useWorkspace() {
  const [documents, setDocuments] = useState<Resume[]>([]),
    [draft, setDraft] = useState<Resume | null>(null),
    [ready, setReady] = useState(false),
    [temporary, setTemporary] = useState(false),
    [status, setStatus] = useState(""),
    [error, setError] = useState("");
  const [history, setHistory] = useState<{ past: Resume[]; future: Resume[] }>({
    past: [],
    future: [],
  });
  const current = useRef(draft);
  current.current = draft;
  const temp = useRef(temporary);
  temp.current = temporary;
  const saved = useRef(new Map<string, string>()),
    revisions = useRef(new Map<string, number>()),
    queue = useRef<Promise<void>>(Promise.resolve()),
    clearing = useRef(false);
  const refresh = useCallback(async () => {
    const docs = await db.documents.orderBy("updatedAt").reverse().toArray();
    setDocuments(docs);
    return docs;
  }, []);
  useEffect(() => {
    void refresh()
      .catch(() => {
        setError(
          "Local storage is unavailable. You can still edit in a temporary session and download a backup.",
        );
        setTemporary(true);
      })
      .finally(() => setReady(true));
  }, [refresh]);
  const save = useCallback(async (doc = current.current) => {
    if (!doc || clearing.current) return;
    if (temp.current) {
      setDocuments((prev) => [doc, ...prev.filter((x) => x.id !== doc.id)]);
      setStatus("Temporary session");
      return;
    }
    const task = queue.current
      .catch(() => {})
      .then(async () => {
        if (clearing.current) return;
        if (saved.current.get(doc.id) === fingerprint(doc)) return;
        setStatus("Saving…");
        try {
          const stored = await saveResume(
            doc,
            revisions.current.get(doc.id) ?? null,
          );
          revisions.current.set(doc.id, stored.revision);
          saved.current.set(doc.id, fingerprint(doc));
          setDocuments((prev) => [
            stored,
            ...prev.filter((x) => x.id !== stored.id),
          ]);
          setStatus("Saved on this device");
          setError("");
        } catch (e) {
          setStatus(
            e instanceof ConflictError ? "Conflicting edits" : "Not saved",
          );
          setError(
            (e as Error).message ||
              "Saving failed. Download a backup to protect your work.",
          );
          throw e;
        }
      });
    queue.current = task;
    return task;
  }, []);
  useEffect(() => {
    if (!draft) return;
    if (temporary) {
      setStatus("Temporary session");
      return;
    }
    setStatus(
      saved.current.get(draft.id) === fingerprint(draft)
        ? "Saved on this device"
        : "Unsaved changes",
    );
    const timer = setTimeout(() => {
      void save(draft).catch(() => {});
    }, 650);
    return () => clearTimeout(timer);
  }, [draft, temporary, save]);
  useEffect(() => {
    const before = (e: BeforeUnloadEvent) => {
      const d = current.current;
      if (
        !clearing.current &&
        d &&
        (temp.current || saved.current.get(d.id) !== fingerprint(d))
      ) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    const hidden = () => {
      if (document.visibilityState === "hidden") void save().catch(() => {});
    };
    const clear = () => {
      clearing.current = true;
      current.current = null;
    };
    window.addEventListener("resume-studio:clear", clear);
    window.addEventListener("beforeunload", before);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.removeEventListener("resume-studio:clear", clear);
      window.removeEventListener("beforeunload", before);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, [save]);
  const open = async (doc: Resume, isNew = false) => {
    await save();
    let chosen = doc;
    if (!isNew && !temp.current) {
      const stored = await db.documents.get(doc.id);
      if (stored) {
        chosen = stored;
        revisions.current.set(doc.id, stored.revision);
        saved.current.set(doc.id, fingerprint(stored));
      } else if (revisions.current.has(doc.id))
        throw new Error(
          "This résumé was removed in another tab. Refresh your workspace.",
        );
    }
    const next = structuredClone(chosen);
    current.current = next;
    setDraft(next);
    setHistory({ past: [], future: [] });
    setError("");
    location.hash = `/editor/${doc.id}`;
  };
  const change = (recipe: (d: Resume) => void) => {
    const prev = current.current;
    if (!prev) return;
    const next = structuredClone(prev);
    recipe(next);
    current.current = next;
    setHistory((h) => ({ past: [...h.past.slice(-39), prev], future: [] }));
    setDraft(next);
  };
  const undo = () => {
    if (!history.past.length || !draft) return;
    setDraft(history.past.at(-1)!);
    setHistory({
      past: history.past.slice(0, -1),
      future: [draft, ...history.future],
    });
  };
  const redo = () => {
    if (!history.future.length || !draft) return;
    setDraft(history.future[0]);
    setHistory({
      past: [...history.past, draft],
      future: history.future.slice(1),
    });
  };
  const home = async () => {
    await save();
    current.current = null;
    setDraft(null);
    location.hash = "/";
  };
  const remove = async (id: string) => {
    if (!temp.current) await removeResume(id);
    setDocuments((prev) => prev.filter((d) => d.id !== id));
  };
  const recover = async () => {
    if (!draft) return;
    await queue.current.catch(() => {});
    const copy = duplicateResume(draft, "recovered");
    setDraft(copy);
    setError("");
  };
  return {
    documents,
    draft,
    ready,
    temporary,
    setTemporary,
    status,
    error,
    setError,
    change,
    undo,
    redo,
    canUndo: !!history.past.length,
    canRedo: !!history.future.length,
    open,
    home,
    save,
    refresh,
    recover,
    remove,
  };
}
