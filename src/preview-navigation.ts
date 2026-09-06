import type { Resume } from "./model";
export const editId = (section: string, entry: string, field: string) =>
  `edit:${[section, entry, field].map(encodeURIComponent).join("/")}`;
export function editSection(target: string) {
  try {
    return target.startsWith("edit:")
      ? decodeURIComponent(target.slice(5).split("/")[0])
      : null;
  } catch {
    return null;
  }
}
export function editLabels(doc: Resume) {
  const labels: Record<string, string> = {};
  for (const key of Object.keys(doc.profile))
    labels[editId("profile", "", key)] =
      `Edit ${key === "summary" ? "professional summary" : key}`;
  for (const section of doc.sections) {
    labels[editId(section.id, "", "heading")] = `Edit ${section.title} heading`;
    for (const e of section.entries) {
      for (const field of ["title", "subtitle", "description"])
        labels[editId(section.id, e.id, field)] =
          `Edit ${field} for ${e.title || section.title}`;
      e.bullets.forEach((_, i) => {
        labels[editId(section.id, e.id, `bullet-${i}`)] =
          `Edit achievement ${i + 1} for ${e.title || section.title}`;
      });
    }
  }
  return labels;
}

export type PdfRegion = {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  target: string;
};
type LayoutNode = {
  type?: string;
  props?: Record<string, unknown>;
  box?: { left: number; top: number; width: number; height: number };
  children?: LayoutNode[];
};
// The renderer's completed layout includes page wrapping and local box offsets.
// Keep this adapter separate and test its coordinates against the emitted PDF.
export function collectEditRegions(layout: unknown): PdfRegion[] {
  const root = layout as LayoutNode | undefined;
  if (!root || !Array.isArray(root.children)) return [];
  const regions: PdfRegion[] = [];
  root.children
    .filter((node) => node.type === "PAGE")
    .forEach((page, index) => {
      const walk = (node: LayoutNode, left: number, top: number) => {
        const box = node.box;
        const x = left + (box?.left || 0),
          y = top + (box?.top || 0);
        const target = node.props?.["data-edit-target"];
        if (
          typeof target === "string" &&
          target.startsWith("edit:") &&
          box &&
          box.width > 0 &&
          box.height > 0
        )
          regions.push({
            page: index + 1,
            x,
            y,
            width: box.width,
            height: box.height,
            target,
          });
        for (const child of node.children || []) walk(child, x, y);
      };
      walk(page, 0, 0);
    });
  return regions;
}
