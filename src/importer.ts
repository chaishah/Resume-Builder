import {
  newResume,
  newSection,
  newEntry,
  sectionNames,
  uid,
  type Resume,
  type SectionType,
} from "./model";
export type Extracted = {
  text: string;
  pages: number;
  warnings: string[];
  scanPages: number[];
};
export type ImportBlock = {
  id: string;
  text: string;
  section: SectionType | "profile" | "summary" | "unassigned";
  page?: number;
};
const aliases: Record<string, SectionType | "summary"> = {
  "work experience": "experience",
  "professional experience": "experience",
  "employment history": "experience",
  "career history": "experience",
  "work history": "experience",
  experience: "experience",
  employment: "experience",
  education: "education",
  qualifications: "education",
  "academic qualifications": "education",
  "education and qualifications": "education",
  skills: "skills",
  "technical skills": "skills",
  "key skills": "skills",
  "core competencies": "skills",
  "skills and expertise": "skills",
  projects: "projects",
  "selected projects": "projects",
  certifications: "certifications",
  "certifications and registrations": "certifications",
  "licenses and certifications": "certifications",
  "professional development": "certifications",
  volunteering: "volunteering",
  "volunteer experience": "volunteering",
  "community involvement": "volunteering",
  awards: "awards",
  languages: "languages",
  referees: "referees",
  references: "referees",
  publications: "publications",
  "professional summary": "summary",
  summary: "summary",
  profile: "summary",
  "career objective": "summary",
  objective: "summary",
};
export function splitImport(text: string): ImportBlock[] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const blocks: ImportBlock[] = [];
  let target: ImportBlock["section"] = "profile",
    buffer: string[] = [];
  let page = 1;
  const flush = () => {
    if (buffer.join("\n").trim())
      blocks.push({
        id: uid(),
        text: buffer.join("\n").trim(),
        section: target,
        page,
      });
    buffer = [];
  };
  for (const line of lines) {
    if (/^\[Page \d+\]$/.test(line.trim())) {
      flush();
      page = Number(line.match(/\d+/)![0]);
      continue;
    }
    const key = line
      .trim()
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[:—–-]+$/, "")
      .trim();
    if (aliases[key]) {
      flush();
      target = aliases[key];
    } else buffer.push(line);
  }
  flush();
  return blocks.length ? blocks : [{ id: uid(), text, section: "unassigned" }];
}
const bullet = /^[\s•●▪◦\-*–]+/;
export function importBlocks(blocks: ImportBlock[]): Resume {
  const d = newResume();
  d.title = "Imported résumé";
  d.sections = [];
  const notes: string[] = [];
  for (const block of blocks) {
    const lines = block.text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (block.section === "unassigned") {
      notes.push(block.text);
      continue;
    }
    if (block.section === "summary") {
      d.profile.summary = [d.profile.summary, block.text]
        .filter(Boolean)
        .join("\n\n");
      continue;
    }
    if (block.section === "profile") {
      for (const line of lines) {
        const email = line.match(/[^\s|<>]+@[^\s|<>]+\.[^\s|<>]+/);
        const phone = line.match(/(?:\+61|0)[\d ()-]{8,18}\d/);
        const link = line.match(
          /(?:https?:\/\/|www\.|linkedin\.com\/|github\.com\/)[^\s|<>]+/gi,
        );
        let remainder = line;
        if (email && !d.profile.email) {
          d.profile.email = email[0].replace(/[.,;]+$/, "");
          remainder = remainder.replace(email[0], "");
        }
        if (phone && !d.profile.phone) {
          d.profile.phone = phone[0];
          remainder = remainder.replace(phone[0], "");
        }
        if (link) {
          d.profile.links = [d.profile.links, ...link]
            .filter(Boolean)
            .join("\n");
          for (const l of link) remainder = remainder.replace(l, "");
        }
        remainder = remainder.replace(/^[\s|·,;]+|[\s|·,;]+$/g, "");
        if (remainder) {
          if (
            !d.profile.name &&
            !email &&
            !phone &&
            !link &&
            remainder.length < 90 &&
            !/resume|curriculum vitae/i.test(remainder)
          )
            d.profile.name = remainder;
          else notes.push(remainder);
        }
      }
      continue;
    }
    let s = d.sections.find((s) => s.type === block.section);
    if (!s) {
      s = newSection(block.section);
      s.entries = [];
      d.sections.push(s);
    }
    const entry = newEntry();
    if (["skills", "languages", "custom", "referees"].includes(block.section)) {
      entry.description = block.text;
    } else {
      entry.title = lines[0] || "";
      const remaining = lines.slice(1);
      entry.bullets = remaining
        .filter((l) => bullet.test(l))
        .map((l) => l.replace(bullet, ""));
      entry.description = remaining.filter((l) => !bullet.test(l)).join("\n");
    }
    s.entries.push(entry);
  }
  d.importNotes = notes.join("\n\n");
  if (d.profile.name) d.title = `${d.profile.name} · imported`;
  return d;
}
export const importSectionOptions = [
  { value: "profile", label: "Contact details" },
  { value: "summary", label: "Professional summary" },
  ...Object.entries(sectionNames).map(([value, label]) => ({ value, label })),
  { value: "unassigned", label: "Keep for later review" },
];
export function extractFile(
  file: File,
  onProgress: (s: string) => void,
  signal: AbortSignal,
): Promise<Extracted> {
  if (file.size > 10 * 1024 * 1024)
    return Promise.reject(new Error("Choose a document smaller than 10 MB."));
  if (file.name.toLowerCase().endsWith(".pdf"))
    return import("./pdf-import").then((m) =>
      m.extractPDF(file, onProgress, signal),
    );
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./import.worker.ts", import.meta.url), {
      type: "module",
    });
    const finish = () => {
      worker.terminate();
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
    };
    const abort = () => {
      finish();
      reject(new DOMException("Import cancelled", "AbortError"));
    };
    const timer = setTimeout(() => {
      finish();
      reject(
        new Error(
          "This document took too long to read. Try a smaller file or paste its text.",
        ),
      );
    }, 60_000);
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) {
      abort();
      return;
    }
    worker.onmessage = (e) => {
      if (e.data.progress) onProgress(e.data.progress);
      else {
        finish();
        e.data.error ? reject(new Error(e.data.error)) : resolve(e.data.result);
      }
    };
    worker.onerror = () => {
      finish();
      reject(
        new Error(
          "The document reader could not start. Try refreshing the app or pasting text.",
        ),
      );
    };
    worker.postMessage(file);
  });
}
