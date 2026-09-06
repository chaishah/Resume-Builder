import { useState } from "react";
import { ArrowLeft, ArrowRight, Plus } from "lucide-react";
import { Field, Area, Select } from "./ui";
import { newEntry, type Resume } from "./model";
import type { Change } from "./EditorForms";
import { stages, writingAdvice } from "./features";
type Step = {
  id: string;
  label: string;
  value: string;
  hint: string;
  area?: boolean;
  set: (d: Resume, value: string) => void;
  sectionId?: string;
  lastEntryField?: boolean;
};
export function WritingPrompts({
  doc,
  change,
  sectionType,
}: {
  doc: Resume;
  change: Change;
  sectionType?: string;
}) {
  const advice = writingAdvice[doc.careerStage];
  return (
    <details className="help writing-prompts">
      <summary>Writing prompts for your career stage</summary>
      <Select
        label="Career stage"
        value={doc.careerStage}
        onChange={(v) =>
          change((d) => {
            d.careerStage = v as Resume["careerStage"];
          })
        }
      >
        {Object.entries(stages).map(([id, label]) => (
          <option key={id} value={id}>
            {label}
          </option>
        ))}
      </Select>
      <p>{advice.prompt}</p>
      <p>
        {sectionType === "education"
          ? "Include the qualification, institution and completion year. Add relevant projects or placements if they strengthen the application."
          : sectionType === "skills"
            ? "Group skills by area and name the tools or techniques you have used. Connect them to examples in your experience."
            : advice.example}
      </p>
      {!sectionType && (
        <>
          <blockquote>{advice.summary}</blockquote>
          <button
            disabled={!!doc.profile.summary.trim()}
            onClick={() =>
              change((d) => {
                d.profile.summary = advice.summary;
              })
            }
          >
            Use outline in an empty summary
          </button>
          <small>
            Replace every bracket with your own details before exporting.
          </small>
        </>
      )}
    </details>
  );
}
export default function GuidedEditor({
  doc,
  change,
  onExit,
}: {
  doc: Resume;
  change: Change;
  onExit: () => void;
}) {
  const [stepId, setStepId] = useState("profile:name");
  const steps: Step[] = [];
  for (const [key, label, hint, area] of [
    [
      "name",
      "What name should employers see?",
      "Use the name you use professionally.",
    ],
    [
      "headline",
      "How would you describe your profession?",
      "For example: Project Coordinator or Graduate Data Analyst.",
    ],
    [
      "email",
      "Which email should employers use?",
      "Choose an address you check regularly.",
    ],
    [
      "phone",
      "What is your contact number?",
      "An Australian mobile number or an international number with country code.",
    ],
    [
      "location",
      "Where are you based?",
      "City and state are enough, for example Perth, WA.",
    ],
    [
      "links",
      "Do you have a professional profile or portfolio?",
      "One relevant link per line. You can skip this.",
      true,
    ],
    [
      "summary",
      "What do you bring to your next role?",
      writingAdvice[doc.careerStage].prompt,
      true,
    ],
  ] as const) {
    const field = key as keyof Resume["profile"];
    steps.push({
      id: `profile:${key}`,
      label,
      hint,
      area: !!area,
      value: doc.profile[field],
      set: (d, v) => {
        d.profile[field] = v;
      },
    });
  }
  for (const section of doc.sections.filter((s) => !s.hidden))
    for (const entry of section.entries) {
      const simple = ["skills", "languages", "referees", "custom"].includes(
        section.type,
      );
      const fields = simple
        ? (["title", "description"] as const)
        : ([
            "title",
            "subtitle",
            "location",
            "start",
            "end",
            "description",
            "bullets",
          ] as const);
      for (const field of fields) {
        const questions = {
          title:
            section.type === "education"
              ? "What qualification did you complete or start?"
              : simple
                ? "What would you call this group?"
                : "What was your role or project?",
          subtitle:
            section.type === "education"
              ? "Which institution did you attend?"
              : "Which organisation was this with?",
          location: "Where was this based?",
          start: "When did you start?",
          end: "When did you finish?",
          description: simple
            ? "What details would you like to include?"
            : "What is useful to know about this experience?",
          bullets: "What did you achieve?",
        };
        const hints = {
          title: section.title,
          subtitle: "Use the organisation or institution name.",
          location: "City / state. Skip if unnecessary.",
          start: "For example: 2022-03 or 2022.",
          end: "Enter a date or mark this as current below.",
          description: "Keep the details relevant to the role you want.",
          bullets: `One achievement per line. ${writingAdvice[doc.careerStage].example}`,
        };
        steps.push({
          id: `${entry.id}:${field}`,
          label: questions[field],
          hint: hints[field],
          value: field === "bullets" ? entry.bullets.join("\n") : entry[field],
          area: field === "description" || field === "bullets",
          sectionId: section.id,
          lastEntryField: field === fields.at(-1),
          set: (d, v) => {
            const e = d.sections
              .find((s) => s.id === section.id)
              ?.entries.find((e) => e.id === entry.id);
            if (e) {
              if (field === "bullets") e.bullets = v.split("\n");
              else e[field] = v;
            }
          },
        });
      }
    }
  const index = Math.max(
      0,
      steps.findIndex((s) => s.id === stepId),
    ),
    step = steps[index];
  const next = () =>
    index < steps.length - 1 ? setStepId(steps[index + 1].id) : onExit();
  const currentEntry = doc.sections
    .flatMap((s) => s.entries)
    .find((e) => step.id === `${e.id}:end`);
  return (
    <div className="guided-editor">
      <div className="label-row">
        <span className="eyebrow">Optional guided editor</span>
        <button className="text-button" onClick={onExit}>
          Return to regular editor
        </button>
      </div>
      <p className="muted">
        Question {index + 1} of {steps.length}. Every answer stays in your
        draft; skip anything that does not apply.
      </p>
      <progress
        aria-label="Guide progress"
        value={index + 1}
        max={steps.length}
      />
      <div className="guide-question" key={step.id}>
        <h2>{step.label}</h2>
        {step.area ? (
          <Area
            autoFocus
            label="Your answer"
            rows={7}
            value={step.value}
            hint={step.hint}
            onChange={(e) => change((d) => step.set(d, e.target.value))}
          />
        ) : (
          <Field
            autoFocus
            label="Your answer"
            value={step.value}
            hint={step.hint}
            disabled={!!currentEntry?.current}
            onChange={(e) => change((d) => step.set(d, e.target.value))}
          />
        )}
        {currentEntry && (
          <label className="inline-check">
            <input
              type="checkbox"
              checked={currentEntry.current}
              onChange={(e) =>
                change((d) => {
                  const found = d.sections
                    .flatMap((s) => s.entries)
                    .find((x) => x.id === currentEntry.id);
                  if (found) found.current = e.target.checked;
                })
              }
            />{" "}
            I am still doing this
          </label>
        )}
        {step.id === "profile:summary" && (
          <WritingPrompts doc={doc} change={change} />
        )}
      </div>
      <div className="guide-actions">
        <button
          disabled={index === 0}
          onClick={() => setStepId(steps[index - 1].id)}
        >
          <ArrowLeft size={16} />
          Back
        </button>
        <button className="text-button" onClick={next}>
          Skip
        </button>
        <button className="primary" onClick={next}>
          {index === steps.length - 1 ? "Finish guide" : "Next"}
          <ArrowRight size={16} />
        </button>
      </div>
      {step.lastEntryField && (
        <button
          className="text-button section-space"
          onClick={() => {
            const entry = newEntry();
            change((d) => {
              d.sections
                .find((s) => s.id === step.sectionId)
                ?.entries.push(entry);
            });
            setStepId(`${entry.id}:title`);
          }}
        >
          <Plus size={16} />
          Add another entry to this section
        </button>
      )}
    </div>
  );
}
