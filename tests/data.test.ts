import "fake-indexeddb/auto";
import Dexie from "dexie";
import { ResumeDB } from "../src/storage";
import { applyPreset, compareResumes, newApplication } from "../src/features";
import { beforeEach, describe, it, expect } from "vitest";
import {
  newResume,
  sampleResume,
  duplicateResume,
  resumeSchema,
  toText,
  safeLink,
  formatDate,
  roleCoverage,
  snapshotDiff,
} from "../src/model";
import {
  db,
  saveResume,
  ConflictError,
  parseBackup,
  restoreBackup,
  exportBackup,
  createSnapshot,
  removeResume,
} from "../src/storage";
import { splitImport, importBlocks } from "../src/importer";
beforeEach(async () => {
  await db.documents.clear();
  await db.snapshots.clear();
  await db.career.clear();
  await db.presets.clear();
});
describe("document integrity", () => {
  it("validates the example and all Australian defaults", () => {
    expect(resumeSchema.parse(sampleResume()).locale).toBe("en-AU");
    expect(newResume().design.pageLimit).toBe(2);
    expect(newResume("graduate").sections[0].type).toBe("education");
  });
  it("makes independent application variants", () => {
    const a = sampleResume(),
      b = duplicateResume(a);
    b.sections[0].entries[0].title = "Different role";
    expect(a.sections[0].entries[0].title).not.toBe(
      b.sections[0].entries[0].title,
    );
    expect(b.id).not.toBe(a.id);
    expect(b.parentId).toBe(a.id);
  });
  it("excludes hidden sections and unassigned import notes from exports", () => {
    const a = sampleResume();
    a.sections[0].hidden = true;
    a.importNotes = "Secret unassigned note";
    const text = toText(a);
    expect(text).not.toContain("Example Research Institute");
    expect(text).not.toContain("Secret unassigned note");
    expect(text).toContain(a.profile.email);
  });
  it("preserves unknown dates and rejects executable link schemes", () => {
    expect(formatDate("2024-03")).toBe("Mar 2024");
    expect(formatDate("2019")).toBe("2019");
    expect(formatDate("Spring 2020")).toBe("Spring 2020");
    expect(safeLink("javascript:alert(1)")).toBeUndefined();
    expect(safeLink("https://example.com")).toBe("https://example.com/");
  });
  it("checks job terms without counting the advertisement as résumé evidence", () => {
    const a = sampleResume();
    a.application.jobAd =
      "Python SQL Kubernetes Terraform stakeholder engagement";
    const results = roleCoverage(a);
    expect(results.find((t) => t.term === "python")?.present).toBe(true);
    expect(results.find((t) => t.term === "kubernetes")?.present).toBe(false);
    a.application.ignoredTerms = ["kubernetes"];
    expect(roleCoverage(a).some((t) => t.term === "kubernetes")).toBe(false);
  });
  it("compares both content and layout changes", () => {
    const a = sampleResume(),
      b = structuredClone(a);
    b.profile.headline = "New headline";
    b.design.spacing = "compact";
    const diff = snapshotDiff(a, b);
    expect(diff.added).toContain("New headline");
    expect(diff.removed).toContain(a.profile.headline);
    expect(diff.designChanged).toBe(true);
  });
});
describe("storage and recovery", () => {
  it("detects stale concurrent writes and preserves the winning document", async () => {
    const a = await saveResume(sampleResume(), null);
    const next = await saveResume({ ...a, title: "Tab A" }, a.revision);
    await expect(
      saveResume({ ...a, title: "Tab B" }, a.revision),
    ).rejects.toBeInstanceOf(ConflictError);
    expect((await db.documents.get(a.id))?.title).toBe("Tab A");
    expect(next.revision).toBe(a.revision + 1);
  });
  it("does not resurrect deleted documents from a stale tab", async () => {
    const a = await saveResume(sampleResume(), null);
    await removeResume(a.id);
    await expect(saveResume(a, a.revision)).rejects.toBeInstanceOf(
      ConflictError,
    );
  });
  it("restores a backup transactionally as separate documents with snapshots", async () => {
    const a = await saveResume(sampleResume(), null);
    await createSnapshot(a, "Submitted");
    const backup = await exportBackup();
    const parsed = parseBackup(JSON.stringify(backup));
    const restored = await restoreBackup(parsed);
    expect(await db.documents.count()).toBe(2);
    expect(restored[0].id).not.toBe(a.id);
    expect(
      (await db.snapshots.where("resumeId").equals(restored[0].id).first())
        ?.document.profile.name,
    ).toBe(a.profile.name);
  });
  it("rejects malformed and future backups before writing anything", async () => {
    expect(() => parseBackup("broken")).toThrow();
    expect(() =>
      parseBackup(JSON.stringify({ kind: "resume-studio-backup", version: 2 })),
    ).toThrow(/different version/);
    expect(() =>
      parseBackup(
        JSON.stringify({
          kind: "resume-studio-backup",
          version: 1,
          documents: [{}],
        }),
      ),
    ).toThrow();
    expect(await db.documents.count()).toBe(0);
  });
  it("retains the latest thirty snapshots without altering the résumé", async () => {
    const a = sampleResume();
    for (let i = 0; i < 32; i++) await createSnapshot(a, `Snapshot ${i}`);
    expect(await db.snapshots.count()).toBe(30);
    expect(a.revision).toBe(0);
  });
});
describe("reviewable import", () => {
  it("preserves ambiguous profile material instead of inventing fields", () => {
    const text =
      "Alex Morgan\nalex@example.com | 0400 000 000\nMelbourne, VIC\nPROFESSIONAL SUMMARY\nA careful analyst.\nWORK EXPERIENCE\nData Analyst\nExample Company 2020–2024\n• Improved reporting\nEDUCATION\nBachelor of Science";
    const blocks = splitImport(text);
    const a = importBlocks(blocks);
    expect(a.profile.name).toBe("Alex Morgan");
    expect(a.profile.email).toBe("alex@example.com");
    expect(a.importNotes).toContain("Melbourne");
    expect(a.sections[0].entries[0].start).toBe("");
    expect(a.sections[0].entries[0].description).toContain("2020–2024");
    expect(a.sections[0].entries[0].bullets).toContain("Improved reporting");
  });
  it("keeps unassigned text intact and source page numbers available", () => {
    const b = splitImport(
      "[Page 1]\nSam Example\nEXPERIENCE\nFirst role\n[Page 2]\nMore evidence",
    );
    expect(b.at(-1)?.page).toBe(2);
    b[1].section = "unassigned";
    expect(importBlocks(b).importNotes).toContain("First role");
  });
});

describe("new workspace tools", () => {
  it("upgrades existing IndexedDB drafts without changing content or revisions", async () => {
    const name = `migration-${crypto.randomUUID()}`;
    const old = new Dexie(name);
    old.version(1).stores({
      documents: "id,updatedAt",
      snapshots: "id,resumeId,createdAt",
      career: "id,type",
    });
    const raw = JSON.parse(JSON.stringify(sampleResume()));
    delete raw.careerStage;
    delete raw.design.marginX;
    delete raw.design.marginY;
    delete raw.application.jobUrl;
    raw.revision = 7;
    await old.table("documents").put(raw);
    old.close();
    const updated = new ResumeDB(name);
    try {
      const doc = await updated.documents.get(raw.id);
      expect(doc?.profile).toEqual(raw.profile);
      expect(doc?.revision).toBe(7);
      expect(doc?.design.marginX).toBe(48);
      expect(doc?.design.marginY).toBe(43);
      expect(doc?.careerStage).toBe("experienced");
      expect(doc?.application.jobUrl).toBe("");
    } finally {
      await updated.delete();
    }
  });
  it("accepts old backups and preserves presets and master links in new backups", async () => {
    const master = sampleResume(),
      variant = duplicateResume(master);
    const old = JSON.parse(
      JSON.stringify({
        kind: "resume-studio-backup",
        version: 1,
        exportedAt: "2026-09-06",
        documents: [master],
      }),
    );
    delete old.documents[0].careerStage;
    delete old.documents[0].design.marginX;
    delete old.documents[0].design.marginY;
    delete old.documents[0].application.jobUrl;
    expect(parseBackup(JSON.stringify(old)).presets).toEqual([]);
    await saveResume(master, null);
    await saveResume(variant, null);
    await db.presets.add({
      id: "test-preset",
      name: "My layout",
      design: { ...master.design, marginX: 36 },
      sectionOrder: ["education", "experience"],
      savedAt: "2026-09-06",
    });
    const restored = await restoreBackup(
      parseBackup(JSON.stringify(await exportBackup())),
    );
    const root = restored.find(
      (d) => d.title === `${master.title} · restored`,
    )!;
    const copy = restored.find(
      (d) => d.title === `${variant.title} · restored`,
    )!;
    expect(copy.parentId).toBe(root.id);
    expect(root.parentId).toBeUndefined();
    const presets = await db.presets.toArray();
    expect(presets).toHaveLength(2);
    expect(presets.find((p) => p.id !== "test-preset")?.design.marginX).toBe(
      36,
    );
  });
  it("applies layout presets without dropping or editing entries", () => {
    const doc = sampleResume(),
      original = structuredClone(doc.sections);
    applyPreset(doc, {
      id: "p",
      name: "Education first",
      design: { ...doc.design, marginX: 36 },
      sectionOrder: ["education", "skills", "experience"],
      savedAt: "",
    });
    expect(doc.sections[0].type).toBe("education");
    expect(doc.design.marginX).toBe(36);
    for (const section of original)
      expect(doc.sections.find((s) => s.id === section.id)?.entries).toEqual(
        section.entries,
      );
  });
  it("creates linked application copies without carrying over another employer’s details", () => {
    const master = sampleResume();
    master.application.status = "Offer";
    master.application.company = "Old employer";
    master.coverLetter.body = "Letter to old employer";
    const next = newApplication(master, {
      company: "New employer",
      role: "Analyst",
      jobUrl: "https://example.com/job",
      deadline: "2026-10-01",
    });
    expect(next.parentId).toBe(master.id);
    expect(next.id).not.toBe(master.id);
    expect(next.application.status).toBe("Preparing");
    expect(next.application.deadline).toBe("2026-10-01");
    expect(next.application.jobUrl).toBe("https://example.com/job");
    expect(next.coverLetter.body).toBe("");
    expect(next.sections).toEqual(master.sections);
    expect(master.application.company).toBe("Old employer");
  });
  it("compares achievement edits, section order and margins without exposing internal IDs", () => {
    const before = sampleResume(),
      after = duplicateResume(before);
    after.sections.reverse();
    after.sections.find((s) => s.type === "experience")!.entries[0].bullets[0] =
      "A revised real achievement";
    after.design.marginX = 36;
    const diff = compareResumes(before, after);
    expect(
      diff.some((r) => r.after.includes("A revised real achievement")),
    ).toBe(true);
    expect(diff.some((r) => r.label === "Layout · side margins")).toBe(true);
    expect(diff.find((r) => r.label === "Section order")?.before).not.toContain(
      before.sections[0].id,
    );
  });
});
