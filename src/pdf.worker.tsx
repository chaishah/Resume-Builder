import { pdf } from "@react-pdf/renderer";
import { ResumePDF, registerFonts, type DocumentKind } from "./document";
import type { Resume } from "./model";
self.onmessage = async (
  e: MessageEvent<{ doc: Resume; root: string; kind: DocumentKind }>,
) => {
  try {
    registerFonts(e.data.root);
    const blob = await pdf(
      <ResumePDF doc={e.data.doc} kind={e.data.kind} />,
    ).toBlob();
    self.postMessage({ blob });
  } catch (error) {
    self.postMessage({
      error: (error as Error).message || "Unable to generate this document.",
    });
  }
};
