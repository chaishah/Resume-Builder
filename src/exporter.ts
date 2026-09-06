import { dateRange, hasEntry, safeLink, toText, type Resume } from "./model";
import type { DocumentKind } from "./document";
export function generatePdf(
  doc: Resume,
  kind: DocumentKind,
  signal: AbortSignal,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./pdf.worker.tsx", import.meta.url), {
      type: "module",
    });
    const cleanup = () => {
      worker.terminate();
      clearTimeout(timeout);
      signal.removeEventListener("abort", abort);
    };
    const abort = () => {
      cleanup();
      reject(new DOMException("Cancelled", "AbortError"));
    };
    const timeout = setTimeout(() => {
      cleanup();
      reject(
        new Error(
          "PDF generation took too long. Try a shorter document or refresh the app.",
        ),
      );
    }, 45_000);
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) {
      abort();
      return;
    }
    worker.onmessage = (e) => {
      cleanup();
      if (e.data.error) reject(new Error(e.data.error));
      else resolve(e.data.blob);
    };
    worker.onerror = (event) => {
      console.error(
        "PDF worker failure:",
        event.message,
        event.filename,
        event.lineno,
        event.colno,
      );
      cleanup();
      reject(
        new Error(
          "The PDF generator could not start. Refresh the app and try again.",
        ),
      );
    };
    worker.postMessage({
      doc,
      kind,
      root: new URL(import.meta.env.BASE_URL, location.origin).href,
    });
  });
}
export async function generateDocx(doc: Resume, kind: DocumentKind = "resume") {
  const {
    Document,
    Packer,
    Paragraph,
    TextRun,
    HeadingLevel,
    ExternalHyperlink,
    AlignmentType,
    Footer,
    PageNumber,
  } = await import("docx");
  const colour = doc.design.accent.slice(1),
    size = doc.design.fontSize * 2;
  const children: InstanceType<typeof Paragraph>[] = [];
  const para = (text: string, opts: Record<string, unknown> = {}) =>
    new Paragraph({
      children: [new TextRun({ text })],
      spacing: { after: 110 },
      ...opts,
    });
  children.push(
    para(doc.profile.name || "Your name", { heading: HeadingLevel.TITLE }),
    para(doc.profile.headline),
    para(
      [doc.profile.email, doc.profile.phone, doc.profile.location]
        .filter(Boolean)
        .join(" | "),
    ),
  );
  for (const value of doc.profile.links.split("\n").filter(Boolean)) {
    const url = safeLink(value);
    children.push(
      url
        ? new Paragraph({
            children: [
              new ExternalHyperlink({
                link: url,
                children: [new TextRun({ text: value, style: "Hyperlink" })],
              }),
            ],
          })
        : para(value),
    );
  }
  if (doc.profile.workRights) children.push(para(doc.profile.workRights));
  if (kind === "resume") {
    if (doc.profile.summary) children.push(para(doc.profile.summary));
    for (const section of doc.sections.filter(
      (s) => !s.hidden && s.entries.some(hasEntry),
    )) {
      children.push(
        para(section.title, {
          heading: HeadingLevel.HEADING_1,
          keepNext: true,
          pageBreakBefore: section.pageBreak,
        }),
      );
      for (const e of section.entries.filter(hasEntry)) {
        if (e.title)
          children.push(
            para(e.title, { heading: HeadingLevel.HEADING_2, keepNext: true }),
          );
        const meta = [e.subtitle, e.location, dateRange(e)]
          .filter(Boolean)
          .join(" | ");
        if (meta) children.push(para(meta));
        if (e.description)
          for (const line of e.description.split("\n"))
            children.push(para(line));
        for (const bullet of e.bullets.filter(Boolean))
          children.push(para(bullet, { bullet: { level: 0 } }));
      }
    }
  } else if (kind === "letter") {
    for (const value of [
      doc.coverLetter.date,
      doc.coverLetter.recipient,
      doc.application.role ? `Re: ${doc.application.role}` : "",
      doc.coverLetter.salutation,
      ...doc.coverLetter.body.split(/\n\s*\n/),
      doc.coverLetter.closing,
      doc.profile.name,
    ].filter(Boolean))
      children.push(para(value));
  } else {
    children.push(
      para("Selection criteria", { heading: HeadingLevel.HEADING_1 }),
    );
    for (const c of doc.application.criteria) {
      children.push(
        para(c.prompt, { heading: HeadingLevel.HEADING_2, keepNext: true }),
      );
      for (const [label, value] of [
        ["Situation", c.situation],
        ["Task", c.task],
        ["Action", c.action],
        ["Result", c.result],
      ])
        if (value) children.push(para(`${label}: ${value}`));
    }
  }
  const output = new Document({
    creator: doc.profile.name,
    title: doc.title,
    styles: {
      default: {
        document: {
          run: {
            font: doc.design.font === "Inter" ? "Calibri" : "Georgia",
            size,
            color: "202A34",
          },
          paragraph: { spacing: { after: 100, line: 270 } },
        },
        title: { run: { size: 52, bold: true, color: colour } },
        heading1: {
          run: { size: 24, bold: true, color: colour },
          paragraph: { spacing: { before: 220, after: 120 } },
        },
        heading2: { run: { size: size + 1, bold: true } },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 860, bottom: 860, left: 960, right: 960 },
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [new TextRun({ children: [PageNumber.CURRENT] })],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });
  return Packer.toBlob(output);
}
export function documentText(d: Resume, kind: DocumentKind) {
  return kind === "resume"
    ? toText(d)
    : kind === "letter"
      ? [
          d.profile.name,
          d.coverLetter.date,
          d.coverLetter.recipient,
          d.coverLetter.salutation,
          d.coverLetter.body,
          d.coverLetter.closing,
          d.profile.name,
        ]
          .filter(Boolean)
          .join("\n\n")
      : d.application.criteria
          .map((c) =>
            [
              c.prompt,
              ...[
                ["Situation", c.situation],
                ["Task", c.task],
                ["Action", c.action],
                ["Result", c.result],
              ]
                .filter(([, v]) => v)
                .map(([k, v]) => `${k}: ${v}`),
            ].join("\n\n"),
          )
          .join("\n\n");
}
