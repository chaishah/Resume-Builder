import { useState } from "react";
import {
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Bookmark,
  Lightbulb,
  EyeOff,
} from "lucide-react";
import { Field, Area, Select, Confirm, Modal } from "./ui";
import {
  newEntry,
  templates,
  type Resume,
  type Section,
  type Entry,
  type CareerItem,
  uid,
} from "./model";
import { db } from "./storage";
export type Change = (recipe: (d: Resume) => void) => void;
export function ProfileEditor({
  doc,
  change,
}: {
  doc: Resume;
  change: Change;
}) {
  const set = (key: keyof Resume["profile"], value: string) =>
    change((d) => {
      d.profile[key] = value;
    });
  return (
    <>
      <div className="panel-title">
        <span className="eyebrow">01 / The introduction</span>
        <h2>Make it easy to find you.</h2>
        <p>A few essentials, followed by a short summary of what you bring.</p>
      </div>
      <div className="form-grid">
        <Field
          label="Full name"
          autoComplete="name"
          value={doc.profile.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="Your name"
        />
        <Field
          label="Professional headline"
          value={doc.profile.headline}
          onChange={(e) => set("headline", e.target.value)}
          placeholder="e.g. Data & Insights Analyst"
        />
        <Field
          label="Email"
          type="email"
          autoComplete="email"
          value={doc.profile.email}
          onChange={(e) => set("email", e.target.value)}
          placeholder="you@example.com"
        />
        <Field
          label="Phone"
          type="tel"
          autoComplete="tel"
          value={doc.profile.phone}
          onChange={(e) => set("phone", e.target.value)}
          placeholder="04xx xxx xxx"
        />
        <Field
          label="City / state"
          value={doc.profile.location}
          onChange={(e) => set("location", e.target.value)}
          placeholder="Melbourne, VIC"
        />
        <Field
          label="Work rights (optional)"
          value={doc.profile.workRights}
          onChange={(e) => set("workRights", e.target.value)}
          placeholder="Only include if relevant"
        />
      </div>
      <Area
        label="Professional links"
        hint="One LinkedIn, portfolio or professional website link per line."
        rows={2}
        value={doc.profile.links}
        onChange={(e) => set("links", e.target.value)}
      />
      <Area
        label="Professional summary"
        hint="Try 3–5 lines: your experience, strengths and what you bring to the role."
        rows={6}
        value={doc.profile.summary}
        onChange={(e) => set("summary", e.target.value)}
        placeholder="Who are you professionally, and what do you do well?"
      />
      <details className="help">
        <summary>What belongs in an Australian résumé?</summary>
        <p>
          Focus on relevant experience and achievements. A photo, date of birth,
          marital status and full home address are usually unnecessary. Follow
          the employer’s page limit and document instructions.
        </p>
        <a
          href="https://www.qld.gov.au/jobs/finding/resume"
          target="_blank"
          rel="noreferrer"
        >
          Australian résumé guidance
        </a>
      </details>
    </>
  );
}
export function AchievementWorkshop({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (text: string) => void;
}) {
  const [action, setAction] = useState(""),
    [how, setHow] = useState(""),
    [result, setResult] = useState("");
  const sentence = [
    action.trim().replace(/[.,;]+$/, ""),
    how.trim() ? `using ${how.trim().replace(/[.,;]+$/, "")}` : "",
    result.trim() ? `, ${result.trim().replace(/[.,;]+$/, "")}` : "",
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/ ,/g, ",");
  const final = sentence
    ? sentence.charAt(0).toUpperCase() + sentence.slice(1) + "."
    : "";
  return (
    <Modal title="Achievement Workshop" onClose={onClose}>
      <p>
        Turn a real contribution into a clear bullet. Every detail comes from
        you.
      </p>
      <Area
        label="What did you do?"
        value={action}
        onChange={(e) => setAction(e.target.value)}
        placeholder="Automated monthly reporting"
        rows={2}
      />
      <Field
        label="How did you do it? (optional)"
        value={how}
        onChange={(e) => setHow(e.target.value)}
        placeholder="Python and shared validation rules"
      />
      <Area
        label="What changed? (optional)"
        value={result}
        onChange={(e) => setResult(e.target.value)}
        placeholder="reducing preparation time from two days to three hours"
        rows={2}
      />
      <small className="muted">
        The placeholders are fictional examples. Only include numbers you can
        substantiate.
      </small>
      <div className="sentence-preview">
        {final || "Your achievement will appear here."}
      </div>
      <div className="modal-actions">
        <button onClick={onClose}>Cancel</button>
        <button
          className="primary"
          disabled={!action.trim()}
          onClick={() => {
            onAdd(final);
            onClose();
          }}
        >
          Add achievement
        </button>
      </div>
    </Modal>
  );
}
export function SectionEditor({
  section,
  change,
  onMessage,
  temporary,
}: {
  section: Section;
  change: Change;
  onMessage: (m: string) => void;
  temporary: boolean;
}) {
  const [remove, setRemove] = useState<string | null>(null),
    [workshop, setWorkshop] = useState<string | null>(null);
  const update = (recipe: (s: Section) => void) =>
    change((d) => {
      const s = d.sections.find((s) => s.id === section.id);
      if (s) recipe(s);
    });
  const entry = (id: string, recipe: (e: Entry) => void) =>
    update((s) => {
      const e = s.entries.find((e) => e.id === id);
      if (e) recipe(e);
    });
  const simple = ["skills", "languages", "referees", "custom"].includes(
    section.type,
  );
  const saveCareer = async (e: Entry) => {
    if (temporary) {
      onMessage(
        "Career Library saves are unavailable in a temporary session. Download a backup to keep this entry.",
      );
      return;
    }
    try {
      const item: CareerItem = {
        id: uid(),
        type: section.type,
        entry: structuredClone(e),
        savedAt: new Date().toISOString(),
      };
      await db.career.put(item);
      onMessage("Entry saved to your Career Library.");
    } catch {
      onMessage(
        "Could not save the entry. Download a backup to protect your work.",
      );
    }
  };
  return (
    <>
      <div className="panel-title">
        <span className="eyebrow">Your story / {section.title}</span>
        <h2>
          {section.type === "experience"
            ? "Show the work that matters."
            : section.title}
        </h2>
        <p>
          {section.type === "experience"
            ? "Lead with what you achieved. Keep each role relevant to your next one."
            : "Add the details that support your application."}
        </p>
      </div>
      <Field
        label="Section heading"
        value={section.title}
        onChange={(e) =>
          update((s) => {
            s.title = e.target.value;
          })
        }
      />
      <div className="inline-options">
        <label>
          <input
            type="checkbox"
            checked={section.hidden}
            onChange={(e) =>
              update((s) => {
                s.hidden = e.target.checked;
              })
            }
          />{" "}
          Hide from exported résumé
        </label>
        <label>
          <input
            type="checkbox"
            checked={section.pageBreak}
            onChange={(e) =>
              update((s) => {
                s.pageBreak = e.target.checked;
              })
            }
          />{" "}
          Start on a new page
        </label>
      </div>
      {section.hidden && (
        <div className="notice">
          <EyeOff size={17} />
          This section is kept in your draft and hidden from exports.
        </div>
      )}
      {section.entries.map((e, index) => (
        <div className="entry-card" key={e.id}>
          <div className="entry-heading">
            <span className="eyebrow">Entry {index + 1}</span>
            <div className="button-group">
              <button
                className="icon-button"
                disabled={index === 0}
                title="Move entry up"
                aria-label={`Move entry ${index + 1} up`}
                onClick={() =>
                  update((s) => {
                    [s.entries[index - 1], s.entries[index]] = [
                      s.entries[index],
                      s.entries[index - 1],
                    ];
                  })
                }
              >
                <ArrowUp size={16} />
              </button>
              <button
                className="icon-button"
                disabled={index === section.entries.length - 1}
                title="Move entry down"
                aria-label={`Move entry ${index + 1} down`}
                onClick={() =>
                  update((s) => {
                    [s.entries[index], s.entries[index + 1]] = [
                      s.entries[index + 1],
                      s.entries[index],
                    ];
                  })
                }
              >
                <ArrowDown size={16} />
              </button>
              <button
                className="icon-button"
                title="Save to Career Library"
                aria-label={`Save entry ${index + 1} to Career Library`}
                onClick={() => void saveCareer(e)}
              >
                <Bookmark size={16} />
              </button>
              <button
                className="icon-button danger-text"
                aria-label={`Delete entry ${index + 1}`}
                onClick={() => setRemove(e.id)}
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
          <Field
            label={
              section.type === "experience" || section.type === "volunteering"
                ? "Role / job title"
                : section.type === "education"
                  ? "Qualification"
                  : section.type === "skills"
                    ? "Skill group"
                    : section.type === "languages"
                      ? "Language"
                      : "Title / name"
            }
            value={e.title}
            onChange={(ev) =>
              entry(e.id, (x) => {
                x.title = ev.target.value;
              })
            }
          />
          {!simple && (
            <>
              <div className="form-grid">
                <Field
                  label={
                    section.type === "education"
                      ? "Institution"
                      : "Organisation / employer"
                  }
                  value={e.subtitle}
                  onChange={(ev) =>
                    entry(e.id, (x) => {
                      x.subtitle = ev.target.value;
                    })
                  }
                />
                <Field
                  label="Location (optional)"
                  value={e.location}
                  onChange={(ev) =>
                    entry(e.id, (x) => {
                      x.location = ev.target.value;
                    })
                  }
                />
                <Field
                  label="Start date"
                  placeholder="2022-03 or 2022"
                  value={e.start}
                  onChange={(ev) =>
                    entry(e.id, (x) => {
                      x.start = ev.target.value;
                    })
                  }
                />
                <Field
                  label="End date"
                  placeholder="2025-06 or 2025"
                  disabled={e.current}
                  value={e.current ? "Present" : e.end}
                  onChange={(ev) =>
                    entry(e.id, (x) => {
                      x.end = ev.target.value;
                    })
                  }
                />
              </div>
              <label className="check">
                <input
                  type="checkbox"
                  checked={e.current}
                  onChange={(ev) =>
                    entry(e.id, (x) => {
                      x.current = ev.target.checked;
                    })
                  }
                />{" "}
                Current / ongoing
              </label>
            </>
          )}
          <Area
            label={
              section.type === "skills"
                ? "Skills"
                : section.type === "languages"
                  ? "Proficiency"
                  : section.type === "referees"
                    ? "Contact details or availability"
                    : "Description (optional)"
            }
            rows={simple ? 4 : 3}
            value={e.description}
            onChange={(ev) =>
              entry(e.id, (x) => {
                x.description = ev.target.value;
              })
            }
            placeholder={
              section.type === "referees" ? "Available on request" : ""
            }
          />
          {!simple && (
            <>
              <div className="label-row">
                <span>Achievements / highlights</span>
                <button
                  className="text-button"
                  onClick={() => setWorkshop(e.id)}
                >
                  <Lightbulb size={15} />
                  Help me write
                </button>
              </div>
              {e.bullets.map((b, i) => (
                <div className="bullet-input" key={i}>
                  <span>•</span>
                  <textarea
                    aria-label={`Achievement ${i + 1} for entry ${index + 1}`}
                    rows={2}
                    value={b}
                    onChange={(ev) =>
                      entry(e.id, (x) => {
                        x.bullets[i] = ev.target.value;
                      })
                    }
                  />
                  <button
                    className="icon-button"
                    aria-label={`Remove achievement ${i + 1}`}
                    onClick={() =>
                      entry(e.id, (x) => {
                        x.bullets.splice(i, 1);
                      })
                    }
                  >
                    <XSmall />
                  </button>
                </div>
              ))}
              <button
                className="text-button"
                onClick={() =>
                  entry(e.id, (x) => {
                    x.bullets.push("");
                  })
                }
              >
                <Plus size={16} />
                Add a bullet
              </button>
            </>
          )}
        </div>
      ))}
      <button
        className="full-button"
        onClick={() =>
          update((s) => {
            s.entries.push(newEntry());
          })
        }
      >
        <Plus size={17} />
        Add {simple ? "entry" : "another entry"}
      </button>
      {remove && (
        <Confirm
          title="Delete this entry?"
          onClose={() => setRemove(null)}
          onConfirm={() => {
            update((s) => {
              s.entries = s.entries.filter((e) => e.id !== remove);
            });
            setRemove(null);
          }}
        >
          You can undo this change while this résumé stays open.
        </Confirm>
      )}
      {workshop && (
        <AchievementWorkshop
          onClose={() => setWorkshop(null)}
          onAdd={(text) =>
            entry(workshop, (e) => {
              e.bullets.push(text);
            })
          }
        />
      )}
    </>
  );
}
function XSmall() {
  return <span aria-hidden="true">×</span>;
}
export function TemplateEditor({
  doc,
  change,
}: {
  doc: Resume;
  change: Change;
}) {
  return (
    <>
      <div className="panel-title">
        <span className="eyebrow">A considered first impression</span>
        <h2>Simple, by design.</h2>
        <p>Five subtle layouts. Your words stay yours when you switch.</p>
      </div>
      <div className="template-grid">
        {templates.map((t) => (
          <button
            key={t.id}
            className={`template-choice ${doc.design.template === t.id ? "selected" : ""}`}
            onClick={() =>
              change((d) => {
                d.design.template = t.id;
                d.design.accent = t.accent;
                d.design.font = t.font;
              })
            }
            aria-pressed={doc.design.template === t.id}
          >
            <div className={`mini-page ${t.id}`} style={{ color: t.accent }}>
              <strong
                style={{
                  fontFamily: t.font === "Source Serif" ? "Georgia" : "inherit",
                }}
              >
                {doc.profile.name || "Your name"}
              </strong>
              <span>{doc.profile.headline || "Professional headline"}</span>
              <hr />
              {[
                doc.sections[0]?.title || "Experience",
                doc.sections[1]?.title || "Education",
              ].map((s, i) => (
                <div key={i}>
                  <b>{s}</b>
                  <i />
                  <i />
                  <i className="short" />
                </div>
              ))}
            </div>
            <span className="template-name">
              {t.name}
              {doc.design.template === t.id && <span>Selected</span>}
            </span>
            <small>{t.description}</small>
          </button>
        ))}
      </div>
      <div className="form-grid">
        <Select
          label="Typeface"
          value={doc.design.font}
          onChange={(v) =>
            change((d) => {
              d.design.font = v as Resume["design"]["font"];
            })
          }
        >
          <option>Inter</option>
          <option>Source Serif</option>
        </Select>
        <Select
          label="Spacing"
          value={doc.design.spacing}
          onChange={(v) =>
            change((d) => {
              d.design.spacing = v as Resume["design"]["spacing"];
            })
          }
        >
          <option value="comfortable">Comfortable</option>
          <option value="balanced">Balanced</option>
          <option value="compact">Compact</option>
        </Select>
        <Select
          label="Body text size"
          value={String(doc.design.fontSize)}
          onChange={(v) =>
            change((d) => {
              d.design.fontSize = Number(v);
            })
          }
        >
          {[10, 10.5, 11, 11.5, 12].map((n) => (
            <option value={n} key={n}>
              {n} pt
            </option>
          ))}
        </Select>
        <Field
          label="Target page count"
          type="number"
          min={1}
          max={20}
          value={doc.design.pageLimit}
          onChange={(e) =>
            change((d) => {
              d.design.pageLimit = Math.max(
                1,
                Math.min(20, Number(e.target.value) || 1),
              );
            })
          }
        />
      </div>
      <div className="field">
        <span>Accent colour</span>
        <div className="swatches">
          {templates.map((t) => (
            <button
              key={t.accent}
              style={{ background: t.accent }}
              className={doc.design.accent === t.accent ? "selected" : ""}
              aria-label={`${t.name} accent`}
              aria-pressed={doc.design.accent === t.accent}
              onClick={() =>
                change((d) => {
                  d.design.accent = t.accent;
                })
              }
            >
              {doc.design.accent === t.accent ? "✓" : ""}
            </button>
          ))}
        </div>
      </div>
      {doc.design.template === "graduate" && (
        <button
          onClick={() =>
            change((d) => {
              const priority = ["education", "projects", "skills"];
              d.sections.sort(
                (a, b) =>
                  (priority.indexOf(a.type) < 0
                    ? 9
                    : priority.indexOf(a.type)) -
                  (priority.indexOf(b.type) < 0 ? 9 : priority.indexOf(b.type)),
              );
            })
          }
        >
          Move education and projects to the top
        </button>
      )}
      <div className="notice">
        A4 pages · Selectable text · No watermark. Page length depends on your
        content. Employer instructions come first.
      </div>
    </>
  );
}
