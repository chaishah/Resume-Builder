import { z } from "zod";

export const uid = () => {
  if (crypto.randomUUID) return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const h = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
};
const text = z.string().max(50_000);
export const sectionTypes = [
  "experience",
  "education",
  "skills",
  "projects",
  "certifications",
  "volunteering",
  "awards",
  "languages",
  "referees",
  "publications",
  "custom",
] as const;
export type SectionType = (typeof sectionTypes)[number];
export const sectionNames: Record<SectionType, string> = {
  experience: "Experience",
  education: "Education",
  skills: "Skills",
  projects: "Projects",
  certifications: "Certifications & registrations",
  volunteering: "Volunteering",
  awards: "Awards",
  languages: "Languages",
  referees: "Referees",
  publications: "Publications",
  custom: "Additional information",
};
export const entrySchema = z.object({
  id: z.string().max(100),
  title: text,
  subtitle: text,
  location: text,
  start: text,
  end: text,
  current: z.boolean(),
  description: text,
  bullets: z.array(text).max(100),
});
export type Entry = z.infer<typeof entrySchema>;
const sectionSchema = z.object({
  id: z.string().max(100),
  type: z.enum(sectionTypes),
  title: text,
  hidden: z.boolean(),
  pageBreak: z.boolean(),
  entries: z.array(entrySchema).max(100),
});
export type Section = z.infer<typeof sectionSchema>;
export const templates = [
  {
    id: "essential",
    name: "Essential",
    description: "Clear. Familiar. Ready for anything.",
    font: "Inter",
    accent: "#253444",
  },
  {
    id: "slate",
    name: "Slate",
    description: "A little colour. A strong impression.",
    font: "Inter",
    accent: "#244d6b",
  },
  {
    id: "editorial",
    name: "Editorial",
    description: "Thoughtful typography. Quiet confidence.",
    font: "Source Serif",
    accent: "#493f3a",
  },
  {
    id: "graduate",
    name: "Graduate",
    description: "Make room for your next chapter.",
    font: "Inter",
    accent: "#245849",
  },
  {
    id: "professional",
    name: "Professional",
    description: "Let your experience lead.",
    font: "Inter",
    accent: "#363c59",
  },
] as const;
export type TemplateId = (typeof templates)[number]["id"];
export const designSchema = z.object({
  template: z.enum([
    "essential",
    "slate",
    "editorial",
    "graduate",
    "professional",
  ]),
  accent: z.enum(["#253444", "#244d6b", "#245849", "#493f3a", "#363c59"]),
  font: z.enum(["Inter", "Source Serif"]),
  spacing: z.enum(["comfortable", "balanced", "compact"]),
  fontSize: z.number().min(10).max(12),
  marginX: z.number().min(32).max(64).default(48),
  marginY: z.number().min(32).max(64).default(43),
  pageLimit: z.number().int().min(1).max(20),
});
export const careerStages = [
  "experienced",
  "graduate",
  "change",
  "returning",
] as const;
export const resumeSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().max(100),
  revision: z.number().int().nonnegative(),
  title: text,
  createdAt: text,
  updatedAt: text,
  parentId: z.string().optional(),
  locale: z.literal("en-AU"),
  careerStage: z.enum(careerStages).default("experienced"),
  profile: z.object({
    name: text,
    headline: text,
    email: text,
    phone: text,
    location: text,
    links: text,
    workRights: text,
    summary: text,
  }),
  sections: z.array(sectionSchema).max(40),
  design: designSchema,
  application: z.object({
    role: text,
    company: text,
    jobUrl: text.default(""),
    jobAd: text,
    requestedFormat: z.enum(["pdf", "docx", "either"]),
    deadline: text,
    status: z.enum(["Preparing", "Applied", "Interview", "Offer", "Closed"]),
    notes: text,
    criteria: z
      .array(
        z.object({
          id: z.string(),
          prompt: text,
          situation: text,
          task: text,
          action: text,
          result: text,
        }),
      )
      .max(30),
    ignoredTerms: z.array(text).max(200),
  }),
  coverLetter: z.object({
    recipient: text,
    salutation: text,
    body: text,
    closing: text,
    date: text,
  }),
  importNotes: text,
});
export type Resume = z.infer<typeof resumeSchema>;
export type CareerItem = {
  id: string;
  type: SectionType;
  entry: Entry;
  savedAt: string;
};
export type Snapshot = {
  id: string;
  resumeId: string;
  label: string;
  createdAt: string;
  document: Resume;
};
export const presetSchema = z.object({
  id: z.string().max(100),
  name: z.string().min(1).max(100),
  design: designSchema,
  sectionOrder: z.array(z.enum(sectionTypes)).max(40),
  savedAt: text,
});
export type TemplatePreset = z.infer<typeof presetSchema>;
export const backupSchema = z.object({
  kind: z.literal("resume-studio-backup"),
  version: z.literal(1),
  exportedAt: text,
  documents: z.array(resumeSchema).max(100),
  presets: z.array(presetSchema).max(100).default([]),
  snapshots: z
    .array(
      z.object({
        id: z.string(),
        resumeId: z.string(),
        label: text,
        createdAt: text,
        document: resumeSchema,
      }),
    )
    .max(500)
    .default([]),
  career: z
    .array(
      z.object({
        id: z.string(),
        type: z.enum(sectionTypes),
        entry: entrySchema,
        savedAt: text,
      }),
    )
    .max(1000)
    .default([]),
});
export type Backup = z.infer<typeof backupSchema>;
export const newEntry = (): Entry => ({
  id: uid(),
  title: "",
  subtitle: "",
  location: "",
  start: "",
  end: "",
  current: false,
  description: "",
  bullets: [],
});
export const newSection = (type: SectionType): Section => ({
  id: uid(),
  type,
  title: sectionNames[type],
  hidden: false,
  pageBreak: false,
  entries: [newEntry()],
});
export function newResume(stage = "experienced"): Resume {
  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    id: uid(),
    revision: 0,
    title: "Untitled résumé",
    createdAt: now,
    updatedAt: now,
    locale: "en-AU",
    careerStage: careerStages.includes(stage as Resume["careerStage"])
      ? (stage as Resume["careerStage"])
      : "experienced",
    profile: {
      name: "",
      headline: "",
      email: "",
      phone: "",
      location: "",
      links: "",
      workRights: "",
      summary: "",
    },
    sections: (stage === "graduate"
      ? ["education", "projects", "skills", "experience"]
      : ["experience", "education", "skills"]
    ).map((t) => newSection(t as SectionType)),
    design: {
      template: stage === "graduate" ? "graduate" : "essential",
      accent: stage === "graduate" ? "#245849" : "#253444",
      font: "Inter",
      spacing: "balanced",
      fontSize: 11,
      marginX: 48,
      marginY: 43,
      pageLimit: 2,
    },
    application: {
      role: "",
      company: "",
      jobUrl: "",
      jobAd: "",
      requestedFormat: "pdf",
      deadline: "",
      status: "Preparing",
      notes: "",
      criteria: [],
      ignoredTerms: [],
    },
    coverLetter: {
      recipient: "",
      salutation: "Dear Hiring Manager,",
      body: "",
      closing: "Kind regards,",
      date: new Date().toLocaleDateString("en-AU", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
    },
    importNotes: "",
  };
}
export function sampleResume(): Resume {
  const d = newResume();
  d.title = "Alex Morgan · example résumé";
  d.profile = {
    name: "Alex Morgan",
    headline: "Data & Insights Analyst",
    email: "alex@example.com",
    phone: "0400 000 000",
    location: "Melbourne, VIC",
    links: "https://linkedin.com/in/example",
    workRights: "",
    summary:
      "Data analyst turning complex information into clear decisions. Experienced in reporting automation, stakeholder collaboration and building reliable data products for research teams.",
  };
  d.application.role = "Senior Data Analyst";
  d.design.template = "slate";
  d.design.accent = "#244d6b";
  d.sections[0].entries = [
    {
      ...newEntry(),
      title: "Data & Insights Analyst",
      subtitle: "Example Research Institute",
      location: "Melbourne, VIC",
      start: "2022-03",
      current: true,
      bullets: [
        "Automated monthly reporting with Python, reducing preparation time from two days to three hours.",
        "Partnered with research teams to define data quality checks across six reporting datasets.",
        "Built Power BI dashboards that helped stakeholders track programme participation.",
      ],
    },
    {
      ...newEntry(),
      title: "Reporting Analyst",
      subtitle: "Example Community Services",
      location: "Melbourne, VIC",
      start: "2020-02",
      end: "2022-02",
      bullets: [
        "Consolidated operational reporting into a shared dashboard used by four teams.",
        "Documented metric definitions and introduced a repeatable monthly review process.",
      ],
    },
  ];
  d.sections[1].entries = [
    {
      ...newEntry(),
      title: "Bachelor of Information Technology",
      subtitle: "Example University",
      end: "2019",
      description: "Data analytics and information systems",
    },
  ];
  d.sections[2].entries = [
    {
      ...newEntry(),
      title: "Data & reporting",
      description:
        "Python, SQL, Power BI, Excel, data quality, stakeholder engagement",
    },
  ];
  return d;
}
export function duplicateResume(doc: Resume, suffix = "copy"): Resume {
  const copy = structuredClone(doc);
  copy.parentId = doc.id;
  copy.id = uid();
  copy.revision = 0;
  copy.title = `${doc.title} · ${suffix}`;
  copy.createdAt = copy.updatedAt = new Date().toISOString();
  return copy;
}
export const hasEntry = (e: Entry) =>
  !![
    e.title,
    e.subtitle,
    e.location,
    e.start,
    e.end,
    e.description,
    ...e.bullets,
  ].some((v) => v.trim());
export const safeLink = (value: string): string | undefined => {
  try {
    const u = new URL(
      value.includes("://") || /^(mailto:|tel:)/i.test(value)
        ? value
        : `https://${value}`,
    );
    return ["https:", "http:", "mailto:", "tel:"].includes(u.protocol)
      ? u.href
      : undefined;
  } catch {
    return undefined;
  }
};
export function formatDate(v: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(v);
  if (m && +m[2] >= 1 && +m[2] <= 12)
    return `${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][+m[2] - 1]} ${m[1]}`;
  return v;
}
export const dateRange = (e: Entry) =>
  [formatDate(e.start), e.current ? "Present" : formatDate(e.end)]
    .filter(Boolean)
    .join(" – ");
export function toText(d: Resume) {
  return [
    d.profile.name,
    d.profile.headline,
    [d.profile.email, d.profile.phone, d.profile.location]
      .filter(Boolean)
      .join(" | "),
    d.profile.links,
    d.profile.workRights,
    d.profile.summary,
    ...d.sections
      .filter((s) => !s.hidden)
      .map((s) =>
        [
          s.title,
          ...s.entries
            .filter(hasEntry)
            .map((e) =>
              [
                e.title,
                [e.subtitle, e.location, dateRange(e)]
                  .filter(Boolean)
                  .join(" | "),
                e.description,
                ...e.bullets.filter(Boolean).map((b) => `• ${b}`),
              ]
                .filter(Boolean)
                .join("\n"),
            ),
        ].join("\n\n"),
      ),
  ]
    .filter(Boolean)
    .join("\n\n");
}
export const fileName = (d: Resume, suffix = "Resume") =>
  `${d.profile.name || "My"}_${d.application.role || ""}_${suffix}`
    .replace(/[^\p{L}\p{N}._-]+/gu, "-")
    .replace(/_{2,}/g, "_")
    .slice(0, 150);
export function reviewDocument(
  d: Resume,
): { label: string; section: string; level: "review" | "tip" }[] {
  const out: { label: string; section: string; level: "review" | "tip" }[] = [];
  if (!d.profile.name.trim())
    out.push({ label: "Add your name.", section: "profile", level: "review" });
  if (!d.profile.email && !d.profile.phone)
    out.push({
      label: "Add an email address or phone number.",
      section: "profile",
      level: "review",
    });
  if (d.profile.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.profile.email))
    out.push({
      label: "Check your email address.",
      section: "profile",
      level: "review",
    });
  if (d.importNotes.trim())
    out.push({
      label: "Review the unassigned text from your import.",
      section: "import-notes",
      level: "review",
    });
  if (!d.profile.summary.trim())
    out.push({
      label: "Consider a short summary tailored to this role.",
      section: "profile",
      level: "tip",
    });
  for (const s of d.sections.filter((s) => !s.hidden))
    for (const e of s.entries.filter(hasEntry)) {
      if (
        e.start &&
        e.end &&
        !e.current &&
        /^\d{4}(-\d{2})?$/.test(e.start) &&
        /^\d{4}(-\d{2})?$/.test(e.end) &&
        e.start > e.end
      )
        out.push({
          label: `Check the dates for ${e.title || s.title}.`,
          section: s.id,
          level: "review",
        });
      if (
        (s.type === "experience" || s.type === "volunteering") &&
        !e.bullets.some((b) => b.trim())
      )
        out.push({
          label: `Add an achievement for ${e.title || s.title}.`,
          section: s.id,
          level: "tip",
        });
    }
  return out;
}
const stop = new Set(
  "about after again also and are as at be been being both but by can candidate company could day deliver do does each experience for from full good great have has help how if in into is it job join looking more must new of on one or our per person position provide required responsibilities role should skills so some strong team than that the their them then there these they this those through time to us use using we well what when where which who will with work working would year years you your ability including excellent".split(
    " ",
  ),
);
export function roleCoverage(d: Resume) {
  const corpus = toText(d).toLowerCase();
  const words =
    d.application.jobAd.toLowerCase().match(/[a-z][a-z0-9+#.-]*/g) || [];
  const counts = new Map<string, number>();
  for (const w of words)
    if (w.length > 2 && !stop.has(w)) counts.set(w, (counts.get(w) || 0) + 1);
  const phrases = [
    "power bi",
    "project management",
    "stakeholder engagement",
    "data quality",
    "machine learning",
    "customer service",
    "selection criteria",
    "working with children",
    "registered nurse",
    "data analysis",
    "continuous improvement",
    "risk management",
    "communication skills",
  ];
  return [
    ...phrases.filter((p) => d.application.jobAd.toLowerCase().includes(p)),
    ...[...counts].sort((a, b) => b[1] - a[1]).map(([w]) => w),
  ]
    .filter(
      (t, i, a) =>
        a.indexOf(t) === i && !d.application.ignoredTerms.includes(t),
    )
    .slice(0, 36)
    .map((term) => ({
      term,
      present: new RegExp(
        `(^|[^a-z0-9])${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`,
        "i",
      ).test(corpus),
    }));
}
export function snapshotDiff(a: Resume, b: Resume) {
  const old = toText(a).split("\n").filter(Boolean),
    next = toText(b).split("\n").filter(Boolean);
  const difference = (left: string[], right: string[]) => {
    const counts = new Map<string, number>();
    for (const line of right) counts.set(line, (counts.get(line) || 0) + 1);
    return left.filter((line) => {
      const count = counts.get(line) || 0;
      if (count) {
        counts.set(line, count - 1);
        return false;
      }
      return true;
    });
  };
  return {
    added: difference(next, old),
    removed: difference(old, next),
    orderChanged: JSON.stringify(old) !== JSON.stringify(next),
    designChanged: JSON.stringify(a.design) !== JSON.stringify(b.design),
    applicationChanged:
      JSON.stringify(a.application) !== JSON.stringify(b.application),
    letterChanged:
      JSON.stringify(a.coverLetter) !== JSON.stringify(b.coverLetter),
  };
}
