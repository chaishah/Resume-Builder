import { editId } from "./preview-navigation";
import {
  Document,
  Page,
  Text,
  View,
  Link,
  Font,
  StyleSheet,
} from "@react-pdf/renderer";
import {
  dateRange,
  hasEntry,
  safeLink,
  type Resume,
  type Entry,
} from "./model";
export type DocumentKind = "resume" | "letter" | "criteria";
let fontRoot = "";
export function registerFonts(root: string) {
  if (fontRoot === root) return;
  fontRoot = root;
  for (const [family, slug] of [
    ["Inter", "inter"],
    ["Source Serif", "source-serif-4"],
  ])
    Font.register({
      family,
      fonts: [400, 600, 700].map((fontWeight) => ({
        src: `${root}fonts/${slug}-latin-${fontWeight}-normal.woff`,
        fontWeight,
      })),
    });
  Font.registerHyphenationCallback((word) => [word]);
}
export function ResumePDF({
  doc,
  kind = "resume",
  onLayout,
}: {
  doc: Resume;
  kind?: DocumentKind;
  onLayout?: (layout: unknown) => void;
}) {
  const { design, profile } = doc;
  const gap =
    design.spacing === "compact"
      ? 7
      : design.spacing === "comfortable"
        ? 13
        : 10;
  const accent = design.accent;
  const styles = StyleSheet.create({
    page: {
      paddingTop: design.marginY,
      paddingBottom: design.marginY,
      paddingHorizontal: design.marginX,
      fontFamily: design.font,
      fontSize: design.fontSize,
      lineHeight: 1.4,
      color: "#202a34",
    },
    name: {
      fontSize: design.template === "professional" ? 25 : 28,
      fontWeight: 700,
      lineHeight: 1.15,
      color: accent,
    },
    headline: { fontSize: 12, marginTop: 5, color: "#465567" },
    contacts: { fontSize: 9.2, marginTop: 8, color: "#465567" },
    link: { color: "#465567", textDecoration: "none", fontSize: 9.2 },
    top: {
      paddingBottom: gap + 5,
      marginBottom: gap + 4,
      borderBottomWidth: design.template === "essential" ? 0 : 1,
      borderBottomColor: accent,
    },
    summary: { marginBottom: gap + 5 },
    heading: {
      fontSize: 11.5,
      fontWeight: 700,
      color: accent,
      marginBottom: 6,
      marginTop: gap + 3,
      textTransform: design.template === "editorial" ? "none" : "uppercase",
      letterSpacing: design.template === "editorial" ? 0 : 0.8,
    },
    entry: { marginBottom: gap },
    title: { fontWeight: 700, fontSize: design.fontSize + 0.4 },
    meta: { fontSize: 9.5, color: "#465567", marginBottom: 3 },
    description: { marginBottom: 3 },
    bullet: { flexDirection: "row", marginBottom: 3 },
    dot: { width: 11, fontSize: 10 },
    bulletText: { flex: 1 },
    footer: {
      position: "absolute",
      bottom: 23,
      left: 48,
      right: 48,
      fontSize: 8,
      color: "#586573",
      textAlign: "right",
    },
    paragraph: { marginBottom: 12 },
  });
  const renderEntry = (e: Entry, sectionId: string) => (
    <View key={e.id} style={styles.entry}>
      {!!e.title && (
        <Text
          data-edit-target={editId(sectionId, e.id, "title")}
          style={styles.title}
          minPresenceAhead={28}
        >
          {e.title}
        </Text>
      )}
      {!![e.subtitle, e.location, dateRange(e)].filter(Boolean).length && (
        <Text
          data-edit-target={editId(sectionId, e.id, "subtitle")}
          style={styles.meta}
          minPresenceAhead={e.description || e.bullets.length ? 16 : 0}
        >
          {[e.subtitle, e.location, dateRange(e)].filter(Boolean).join("  |  ")}
        </Text>
      )}
      {!!e.description && (
        <Text
          data-edit-target={editId(sectionId, e.id, "description")}
          style={styles.description}
          orphans={2}
          widows={2}
        >
          {e.description}
        </Text>
      )}
      {e.bullets.map((b, i) =>
        b.trim() ? (
          <View key={i} style={styles.bullet}>
            <Text style={styles.dot}>•</Text>
            <Text
              data-edit-target={editId(sectionId, e.id, `bullet-${i}`)}
              style={styles.bulletText}
              orphans={2}
              widows={2}
            >
              {b}
            </Text>
          </View>
        ) : null,
      )}
    </View>
  );
  return (
    <Document
      onRender={(params) =>
        onLayout?.(
          (params as { _INTERNAL__LAYOUT__DATA_?: unknown })
            ._INTERNAL__LAYOUT__DATA_,
        )
      }
      title={`${profile.name || "Résumé"}${kind === "letter" ? " · Cover letter" : kind === "criteria" ? " · Selection criteria" : ""}`}
      author={profile.name}
      language="en-AU"
    >
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.top} wrap={false}>
          <Text
            data-edit-target={editId("profile", "", "name")}
            style={styles.name}
          >
            {profile.name || "Your name"}
          </Text>
          {!!profile.headline && (
            <Text
              data-edit-target={editId("profile", "", "headline")}
              style={styles.headline}
            >
              {profile.headline}
            </Text>
          )}
          <Text
            data-edit-target={editId("profile", "", "email")}
            style={styles.contacts}
          >
            {[profile.email, profile.phone, profile.location]
              .filter(Boolean)
              .join("  |  ")}
          </Text>
          {profile.links
            .split("\n")
            .filter((s) => s.trim())
            .map((value, i) =>
              safeLink(value.trim()) ? (
                <Link
                  data-edit-target={
                    i === 0 ? editId("profile", "", "links") : undefined
                  }
                  key={i}
                  src={safeLink(value.trim())!}
                  style={styles.link}
                >
                  {value.trim()}
                </Link>
              ) : (
                <Text
                  data-edit-target={
                    i === 0 ? editId("profile", "", "links") : undefined
                  }
                  key={i}
                  style={styles.contacts}
                >
                  {value.trim()}
                </Text>
              ),
            )}
          {!!profile.workRights && (
            <Text
              data-edit-target={editId("profile", "", "workRights")}
              style={styles.contacts}
            >
              {profile.workRights}
            </Text>
          )}
        </View>
        {kind === "resume" ? (
          <>
            {!!profile.summary && (
              <Text
                data-edit-target={editId("profile", "", "summary")}
                style={styles.summary}
                orphans={2}
                widows={2}
              >
                {profile.summary}
              </Text>
            )}
            {doc.sections
              .filter((s) => !s.hidden && s.entries.some(hasEntry))
              .map((s) => (
                <View key={s.id} break={s.pageBreak}>
                  <Text
                    data-edit-target={editId(s.id, "", "heading")}
                    style={styles.heading}
                    minPresenceAhead={48}
                  >
                    {s.title}
                  </Text>
                  {s.entries.filter(hasEntry).map((e) => renderEntry(e, s.id))}
                </View>
              ))}
          </>
        ) : kind === "letter" ? (
          <>
            <Text style={styles.paragraph}>{doc.coverLetter.date}</Text>
            {!!doc.coverLetter.recipient && (
              <Text style={styles.paragraph}>{doc.coverLetter.recipient}</Text>
            )}
            {!!doc.application.role && (
              <Text style={styles.title}>
                Re: {doc.application.role}
                {doc.application.company ? ` · ${doc.application.company}` : ""}
              </Text>
            )}
            <Text style={{ ...styles.paragraph, marginTop: 12 }}>
              {doc.coverLetter.salutation}
            </Text>
            {doc.coverLetter.body
              .split(/\n\s*\n/)
              .filter(Boolean)
              .map((p, i) => (
                <Text key={i} style={styles.paragraph} orphans={2} widows={2}>
                  {p}
                </Text>
              ))}
            <Text>
              {doc.coverLetter.closing}
              {"\n"}
              {profile.name}
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.title}>
              Selection criteria
              {doc.application.role ? ` · ${doc.application.role}` : ""}
            </Text>
            {doc.application.criteria.map((c) => (
              <View key={c.id}>
                <Text style={styles.heading} minPresenceAhead={40}>
                  {c.prompt}
                </Text>
                {[
                  ["Situation", c.situation],
                  ["Task", c.task],
                  ["Action", c.action],
                  ["Result", c.result],
                ]
                  .filter(([, t]) => t.trim())
                  .map(([label, t]) => (
                    <View key={label}>
                      <Text style={{ fontWeight: 600 }} minPresenceAhead={24}>
                        {label}
                      </Text>
                      <Text style={styles.paragraph} orphans={2} widows={2}>
                        {t}
                      </Text>
                    </View>
                  ))}
              </View>
            ))}
          </>
        )}
        <Text
          fixed
          style={styles.footer}
          render={({ pageNumber, totalPages }) =>
            totalPages > 1 ? `${pageNumber} / ${totalPages}` : ""
          }
        />
      </Page>
    </Document>
  );
}
