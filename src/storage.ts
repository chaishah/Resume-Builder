import Dexie, { type Table } from "dexie";
import {
  backupSchema,
  resumeSchema,
  duplicateResume,
  uid,
  type Resume,
  type Snapshot,
  type CareerItem,
  type Backup,
} from "./model";
class ResumeDB extends Dexie {
  documents!: Table<Resume, string>;
  snapshots!: Table<Snapshot, string>;
  career!: Table<CareerItem, string>;
  constructor() {
    super("chai-resume-studio-v1");
    this.version(1).stores({
      documents: "id,updatedAt",
      snapshots: "id,resumeId,createdAt",
      career: "id,type",
    });
  }
}
export const db = new ResumeDB();
export class ConflictError extends Error {
  constructor() {
    super(
      "This résumé changed in another tab. Save your edits as a copy to keep both versions.",
    );
  }
}
export async function saveResume(doc: Resume, expectedRevision: number | null) {
  const valid = resumeSchema.parse(doc);
  return db.transaction("rw", db.documents, async () => {
    const old = await db.documents.get(valid.id);
    if (old && (expectedRevision === null || old.revision !== expectedRevision))
      throw new ConflictError();
    if (!old && expectedRevision !== null) throw new ConflictError();
    const saved = {
      ...valid,
      revision: (old?.revision ?? -1) + 1,
      updatedAt: new Date().toISOString(),
    };
    await db.documents.put(saved);
    return saved;
  });
}
export async function createSnapshot(doc: Resume, label: string) {
  const s: Snapshot = {
    id: uid(),
    resumeId: doc.id,
    label,
    createdAt: new Date().toISOString(),
    document: structuredClone(doc),
  };
  await db.transaction("rw", db.snapshots, async () => {
    await db.snapshots.put(s);
    const all = await db.snapshots
      .where("resumeId")
      .equals(doc.id)
      .sortBy("createdAt");
    if (all.length > 30)
      await db.snapshots.bulkDelete(
        all.slice(0, all.length - 30).map((x) => x.id),
      );
  });
  return s;
}
export async function removeResume(id: string) {
  await db.transaction("rw", db.documents, db.snapshots, async () => {
    await db.documents.delete(id);
    await db.snapshots.where("resumeId").equals(id).delete();
  });
}
export function parseBackup(input: string): Backup {
  if (input.length > 15_000_000)
    throw new Error("This backup is too large. Choose a file under 15 MB.");
  let raw;
  try {
    raw = JSON.parse(input);
  } catch {
    throw new Error(
      "This is not a readable JSON backup. Your existing drafts are unchanged.",
    );
  }
  if (raw?.kind !== "resume-studio-backup")
    throw new Error(
      "Choose a Resume Studio backup. Other JSON formats are not supported.",
    );
  if (raw.version !== 1)
    throw new Error(
      "This backup uses a different version. Update the app before restoring it.",
    );
  const result = backupSchema.safeParse(raw);
  if (!result.success)
    throw new Error(
      "The backup is incomplete or invalid. No drafts have been changed.",
    );
  return result.data;
}
export async function exportBackup(current?: Resume): Promise<Backup> {
  const documents = await db.documents.toArray();
  if (current) {
    const index = documents.findIndex((d) => d.id === current.id);
    if (index >= 0) documents[index] = current;
    else documents.push(current);
  }
  return {
    kind: "resume-studio-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    documents,
    snapshots: await db.snapshots.toArray(),
    career: await db.career.toArray(),
  };
}
export async function restoreBackup(backup: Backup) {
  const mapping = new Map<string, string>();
  const docs = backup.documents.map((d) => {
    const c = duplicateResume(d, "restored");
    mapping.set(d.id, c.id);
    return c;
  });
  await db.transaction(
    "rw",
    db.documents,
    db.snapshots,
    db.career,
    async () => {
      await db.documents.bulkPut(docs);
      await db.snapshots.bulkPut(
        backup.snapshots
          .filter((s) => mapping.has(s.resumeId))
          .map((s) => ({
            ...s,
            id: uid(),
            resumeId: mapping.get(s.resumeId)!,
            document: { ...s.document, id: mapping.get(s.resumeId)! },
          })),
      );
      await db.career.bulkPut(backup.career.map((c) => ({ ...c, id: uid() })));
    },
  );
  return docs;
}
export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.rel = "noopener";
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
export const downloadJSON = (data: unknown, name: string) =>
  downloadBlob(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
    name,
  );
