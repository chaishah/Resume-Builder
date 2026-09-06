import "fake-indexeddb/auto";
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
