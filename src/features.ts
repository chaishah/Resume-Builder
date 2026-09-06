import {
  duplicateResume,
  newResume,
  type Resume,
  type TemplatePreset,
} from "./model";
export const stages = {
  experienced: "Building on my experience",
  graduate: "Starting out / graduating",
  change: "Changing careers",
  returning: "Returning to work",
};
export const writingAdvice = {
  experienced: {
    prompt:
      "Which problems do you solve, who benefits, and what evidence shows your impact?",
    summary:
      "[Your profession] with experience in [areas]. Skilled in [strengths], with a record of [a real contribution]. Seeking to bring [relevant value] to [target role].",
    example:
      "For example: “Simplified the monthly reporting process, allowing the team to review results three days earlier.” Use only outcomes you can support.",
  },
  graduate: {
    prompt:
      "What have you demonstrated through study, placements, part-time work or projects?",
    summary:
      "[Qualification] graduate with practical experience in [project or placement]. Developed [relevant skills] through [specific experience]. Interested in contributing to [target work].",
    example:
      "For example: “Built and tested a booking prototype with a four-person university project team.” Placements and assessed projects can provide evidence.",
  },
  change: {
    prompt:
      "Which skills from your previous work transfer directly to the new role?",
    summary:
      "[Current profession] moving into [target field], bringing experience in [transferable strengths]. Built relevant capability through [training or project]. Ready to contribute to [target work].",
    example:
      "For example: “Coordinated competing customer requests and kept stakeholders informed of delivery dates.” Explain the relevance to the new role.",
  },
  returning: {
    prompt:
      "Which existing strengths and recent learning prepare you for your return?",
    summary:
      "[Your profession] returning to [field], with experience in [strengths]. Recently refreshed [relevant capability] through [course, project or activity]. Seeking [target work].",
    example:
      "For example: “Completed a refresher course and used the tools to organise a community project.” You choose whether to explain a career break; private details are unnecessary.",
  },
};
export type FieldDifference = { label: string; before: string; after: string };
export function compareResumes(
  before: Resume,
  after: Resume,
): FieldDifference[] {
  const rows: FieldDifference[] = [];
  const add = (label: string, a: unknown, b: unknown) => {
    const format = (value: unknown) =>
      Array.isArray(value) ? value.join("\n") : String(value ?? "");
    const left = format(a),
      right = format(b);
    if (left !== right) rows.push({ label, before: left, after: right });
  };
  for (const key of Object.keys(before.profile) as (keyof Resume["profile"])[])
    add(`Contact & summary · ${key}`, before.profile[key], after.profile[key]);
  add("Résumé name", before.title, after.title);
  add("Career stage", stages[before.careerStage], stages[after.careerStage]);
  add("Unassigned import text", before.importNotes, after.importNotes);
  if (
    before.sections.map((s) => s.id).join("|") !==
    after.sections.map((s) => s.id).join("|")
  )
    add(
      "Section order",
      before.sections.map((s) => s.title),
      after.sections.map((s) => s.title),
    );
  for (const id of new Set([
    ...before.sections.map((s) => s.id),
    ...after.sections.map((s) => s.id),
  ])) {
    const a = before.sections.find((s) => s.id === id),
      b = after.sections.find((s) => s.id === id);
    const title = b?.title || a!.title;
    add(`${title} · heading`, a?.title, b?.title);
    add(
      `${title} · visibility`,
      a ? (a.hidden ? "Hidden" : "Included") : "",
      b ? (b.hidden ? "Hidden" : "Included") : "",
    );
    add(`${title} · new page`, a?.pageBreak, b?.pageBreak);
    if (
      a?.entries.map((e) => e.id).join("|") !==
      b?.entries.map((e) => e.id).join("|")
    )
      add(
        `${title} · entry order`,
        a?.entries.map((e) => e.title || "Untitled entry"),
        b?.entries.map((e) => e.title || "Untitled entry"),
      );
    for (const eid of new Set([
      ...(a?.entries.map((e) => e.id) || []),
      ...(b?.entries.map((e) => e.id) || []),
    ])) {
      const left = a?.entries.find((e) => e.id === eid),
        right = b?.entries.find((e) => e.id === eid);
      for (const key of [
        "title",
        "subtitle",
        "location",
        "start",
        "end",
        "current",
        "description",
        "bullets",
      ] as const)
        add(
          `${title} / ${right?.title || left?.title || "Entry"} · ${key}`,
          left?.[key],
          right?.[key],
        );
    }
  }
  for (const key of Object.keys(after.design) as (keyof Resume["design"])[])
    add(`Layout · ${key}`, before.design[key], after.design[key]);
  for (const key of [
    "role",
    "company",
    "jobUrl",
    "deadline",
    "status",
    "notes",
    "jobAd",
    "requestedFormat",
  ] as const)
    add(
      `Application · ${key}`,
      before.application[key],
      after.application[key],
    );
  for (const key of Object.keys(
    after.coverLetter,
  ) as (keyof Resume["coverLetter"])[])
    add(
      `Cover letter · ${key}`,
      before.coverLetter[key],
      after.coverLetter[key],
    );
  const criteriaText = (d: Resume) =>
    d.application.criteria
      .map((c) =>
        [c.prompt, c.situation, c.task, c.action, c.result]
          .filter(Boolean)
          .join("\n"),
      )
      .join("\n\n");
  add("Selection criteria", criteriaText(before), criteriaText(after));
  add(
    "Ignored job terms",
    before.application.ignoredTerms,
    after.application.ignoredTerms,
  );
  for (const row of rows)
    row.label = row.label
      .replace(/marginX/g, "side margins")
      .replace(/marginY/g, "top / bottom margins")
      .replace(/fontSize/g, "text size")
      .replace(/pageLimit/g, "page target")
      .replace(/workRights/g, "work rights")
      .replace(/jobUrl/g, "job link")
      .replace(/jobAd/g, "job advertisement")
      .replace(/requestedFormat/g, "requested format");
  return rows;
}
export function applyPreset(doc: Resume, preset: TemplatePreset) {
  doc.design = structuredClone(preset.design);
  const rank = (type: Resume["sections"][number]["type"]) => {
    const n = preset.sectionOrder.indexOf(type);
    return n < 0 ? 999 : n;
  };
  doc.sections.sort((a, b) => rank(a.type) - rank(b.type));
}
export function newApplication(
  base: Resume | undefined,
  values: { company: string; role: string; jobUrl: string; deadline: string },
) {
  const doc = base ? duplicateResume(base, "application") : newResume();
  doc.application = { ...newResume().application, ...values };
  doc.coverLetter = newResume().coverLetter;
  doc.title =
    [values.company, values.role].filter(Boolean).join(" · ") ||
    "New application";
  return doc;
}
export function deadlineLabel(deadline: string, today = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(deadline)) return "";
  const localToday = Date.UTC(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const due = Date.parse(`${deadline}T00:00:00Z`);
  if (!Number.isFinite(due)) return "";
  const days = Math.round((due - localToday) / 86400000);
  return days < 0
    ? "Closing date passed"
    : days === 0
      ? "Closes today"
      : days === 1
        ? "Closes tomorrow"
        : `Closes in ${days} days`;
}
export function contentWeights(doc: Resume) {
  const words = (text: string) =>
    text.trim().split(/\s+/).filter(Boolean).length;
  return [
    {
      id: "profile",
      title: "Contact & summary",
      words: words(Object.values(doc.profile).join(" ")),
    },
    ...doc.sections
      .filter((s) => !s.hidden)
      .map((s) => ({
        id: s.id,
        title: s.title,
        words: words(
          s.entries
            .map((e) =>
              [e.title, e.subtitle, e.description, ...e.bullets].join(" "),
            )
            .join(" "),
        ),
      })),
  ].sort((a, b) => b.words - a.words);
}
