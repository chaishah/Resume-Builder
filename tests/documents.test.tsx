import {
  collectEditRegions,
  editId,
  type PdfRegion,
} from "../src/preview-navigation";
import { describe, it, expect, vi } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import { sampleResume, newEntry, templates } from "../src/model";
import { ResumePDF, registerFonts } from "../src/document";
import { generateDocx } from "../src/exporter";
import { readPdfPageText } from "../src/pdf-text";
import { mkdir, writeFile } from "node:fs/promises";
import JSZip from "jszip";
registerFonts(`${process.cwd()}/public/`);
describe("downloaded documents", () => {
  it("extracts PDF text when streams have no async iterator, as in older Safari", async () => {
    const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const buffer = await renderToBuffer(<ResumePDF doc={sampleResume()} />);
    const task = getDocument({ data: new Uint8Array(buffer) });
    try {
      const pdf = await task.promise;
      let text = "";
      for (let n = 1; n <= pdf.numPages; n++) {
        const page = await pdf.getPage(n);
        const original = page.streamTextContent.bind(page);
        const streams: ReadableStream[] = [];
        vi.spyOn(page, "streamTextContent").mockImplementation((options) => {
          const stream = original(options);
          Object.defineProperty(stream, Symbol.asyncIterator, {
            value: undefined,
          });
          streams.push(stream);
          return stream;
        });
        const content = await readPdfPageText(page);
        text += content.items.map((i) => ("str" in i ? i.str : "")).join(" ");
        expect(streams.length).toBeGreaterThan(0);
        expect(streams.every((stream) => !stream.locked)).toBe(true);
      }
      expect(text).toContain("Alex Morgan");
      expect(text).toContain("alex@example.com");
      expect(text).toContain("Automated monthly reporting");
    } finally {
      await task.destroy();
    }
  }, 30000);
  it("creates selectable A4 PDFs for every template", async () => {
    const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
    await mkdir("test-results", { recursive: true });
    for (const template of templates) {
      const d = sampleResume();
      d.design.template = template.id;
      d.design.font = template.font;
      d.design.accent = template.accent;
      d.profile.name = "Alex Émery";
      let regions: PdfRegion[] = [];
      const buffer = await renderToBuffer(
        <ResumePDF
          doc={d}
          onLayout={(layout) => {
            regions = collectEditRegions(layout);
          }}
        />,
      );
      const nameRegion = regions.find(
        (r) => r.target === editId("profile", "", "name"),
      )!;
      expect(nameRegion).toBeDefined();
      expect(nameRegion.x).toBeCloseTo(d.design.marginX, 0);
      expect(nameRegion.y).toBeCloseTo(d.design.marginY, 0);
      expect(
        regions.some(
          (r) =>
            r.target ===
            editId(d.sections[0].id, d.sections[0].entries[0].id, "bullet-0"),
        ),
      ).toBe(true);
      const task = getDocument({
        data: new Uint8Array(buffer),
        useSystemFonts: true,
      });
      const pdf = await task.promise;
      let text = "";
      for (let n = 1; n <= pdf.numPages; n++) {
        const page = await pdf.getPage(n);
        const vp = page.getViewport({ scale: 1 });
        expect(vp.width).toBeCloseTo(595.28, 0);
        expect(vp.height).toBeCloseTo(841.89, 0);
        text += (await page.getTextContent()).items
          .map((x) => ("str" in x ? x.str : ""))
          .join(" ");
      }
      const namePage = await pdf.getPage(nameRegion.page);
      const nameItem = (await readPdfPageText(namePage)).items.find(
        (i) => "str" in i && i.str.includes("Alex Émery"),
      );
      expect(nameItem && "transform" in nameItem).toBe(true);
      if (nameItem && "transform" in nameItem) {
        const baseline =
          namePage.getViewport({ scale: 1 }).height - nameItem.transform[5];
        expect(baseline).toBeGreaterThanOrEqual(nameRegion.y);
        expect(baseline).toBeLessThan(nameRegion.y + nameRegion.height + 2);
      }
      expect(text).not.toContain("Made by Chai");
      expect(text).toContain("Alex Émery");
      expect(text).toContain("alex@example.com");
      expect(text).toContain("Automated monthly reporting");
      expect(pdf.numPages).toBeLessThanOrEqual(2);
      await writeFile(`test-results/${template.id}.pdf`, buffer);
      await task.destroy();
    }
  }, 30000);
  it("paginates long careers without dropping the last achievement", async () => {
    const d = sampleResume();
    for (let i = 0; i < 10; i++)
      d.sections[0].entries.push({
        ...newEntry(),
        title: `Historical role ${i}`,
        subtitle: "Example Organisation",
        start: `${2000 + i}`,
        end: `${2001 + i}`,
        bullets: Array.from(
          { length: 4 },
          (_, n) =>
            `Delivered project ${i}-${n} with colleagues, improving a documented workflow and keeping stakeholders informed.`,
        ),
      });
    d.sections[0].entries.at(-1)!.bullets.push("FINAL ACHIEVEMENT SENTINEL");
    let regions: PdfRegion[] = [];
    const buffer = await renderToBuffer(
      <ResumePDF
        doc={d}
        onLayout={(layout) => {
          regions = collectEditRegions(layout);
        }}
      />,
    );
    const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const task = getDocument({ data: new Uint8Array(buffer) });
    const pdf = await task.promise;
    expect(pdf.numPages).toBeGreaterThan(2);
    const lastEntry = d.sections[0].entries.at(-1)!;
    const region = regions.find(
      (r) =>
        r.target ===
        editId(
          d.sections[0].id,
          lastEntry.id,
          `bullet-${lastEntry.bullets.length - 1}`,
        ),
    )!;
    expect(region).toBeDefined();
    expect(region.page).toBeGreaterThan(1);
    const regionPage = await pdf.getPage(region.page);
    const item = (await readPdfPageText(regionPage)).items.find(
      (i) => "str" in i && i.str.includes("FINAL ACHIEVEMENT SENTINEL"),
    );
    expect(item && "transform" in item).toBe(true);
    if (item && "transform" in item) {
      const baseline =
        regionPage.getViewport({ scale: 1 }).height - item.transform[5];
      expect(baseline).toBeGreaterThanOrEqual(region.y);
      expect(baseline).toBeLessThan(region.y + region.height + 2);
    }
    const page = await pdf.getPage(pdf.numPages);
    const text = (await page.getTextContent()).items
      .map((x) => ("str" in x ? x.str : ""))
      .join(" ");
    let all = "";
    for (let i = 1; i <= pdf.numPages; i++)
      all += (await (await pdf.getPage(i)).getTextContent()).items
        .map((x) => ("str" in x ? x.str : ""))
        .join(" ");
    expect(all).toContain("FINAL ACHIEVEMENT SENTINEL");
    expect(text.trim().length).toBeGreaterThan(20);
    await writeFile("test-results/long-career.pdf", buffer);
    await task.destroy();
  }, 30000);
  it("produces editable Word documents and complete application packs", async () => {
    const d = sampleResume();
    d.coverLetter.body =
      "I am applying for the analyst position.\n\nMy reporting work demonstrates the experience outlined in my résumé.";
    d.application.criteria = [
      {
        id: "example",
        prompt: "Demonstrate collaboration",
        situation: "A shared reporting project.",
        task: "Align definitions.",
        action: "Facilitated a working session.",
        result: "Agreed definitions were documented.",
      },
    ];
    for (const kind of ["resume", "letter", "criteria"] as const) {
      const blob = await generateDocx(d, kind);
      const zip = await JSZip.loadAsync(await blob.arrayBuffer());
      const xml = await zip.file("word/document.xml")!.async("string");
      expect(xml).toContain("Alex Morgan");
      expect(xml).toContain(
        kind === "resume"
          ? "Automated monthly reporting"
          : kind === "letter"
            ? "applying for the analyst"
            : "Agreed definitions",
      );
      await writeFile(
        `test-results/${kind}.docx`,
        new Uint8Array(await blob.arrayBuffer()),
      );
      const buffer = await renderToBuffer(<ResumePDF doc={d} kind={kind} />);
      expect(buffer.byteLength).toBeGreaterThan(1000);
    }
  }, 30000);
});
