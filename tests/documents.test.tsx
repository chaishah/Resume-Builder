import { describe, it, expect } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import { sampleResume, newEntry, templates } from "../src/model";
import { ResumePDF, registerFonts } from "../src/document";
import { generateDocx } from "../src/exporter";
import { mkdir, writeFile } from "node:fs/promises";
import JSZip from "jszip";
registerFonts(`${process.cwd()}/public/`);
describe("downloaded documents", () => {
  it("creates selectable A4 PDFs for every template", async () => {
    const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
    await mkdir("test-results", { recursive: true });
    for (const template of templates) {
      const d = sampleResume();
      d.design.template = template.id;
      d.design.font = template.font;
      d.design.accent = template.accent;
      d.profile.name = "Alex Émery";
      const buffer = await renderToBuffer(<ResumePDF doc={d} />);
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
    const buffer = await renderToBuffer(<ResumePDF doc={d} />);
    const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const task = getDocument({ data: new Uint8Array(buffer) });
    const pdf = await task.promise;
    expect(pdf.numPages).toBeGreaterThan(2);
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
