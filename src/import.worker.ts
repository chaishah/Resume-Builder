import type { Extracted } from "./importer";
const send = (progress: string) => self.postMessage({ progress });
self.onmessage = async (event: MessageEvent<File>) => {
  try {
    const file = event.data;
    if (file.size > 10 * 1024 * 1024)
      throw new Error("Choose a document smaller than 10 MB.");
    const ext = file.name.split(".").pop()?.toLowerCase();
    const bytes = new Uint8Array(await file.arrayBuffer());
    let result: Extracted = { text: "", pages: 1, warnings: [], scanPages: [] };
    if (ext === "docx") {
      if (bytes[0] !== 0x50 || bytes[1] !== 0x4b)
        throw new Error(
          "This file does not appear to be a Word DOCX document.",
        );
      send("Checking Word document…");
      const { default: JSZip } = await import("jszip");
      const zip = await JSZip.loadAsync(bytes);
      const entries = Object.values(zip.files);
      const expanded = entries.reduce(
        (n, e) =>
          n +
          ((e as unknown as { _data?: { uncompressedSize?: number } })._data
            ?.uncompressedSize || 0),
        0,
      );
      if (entries.length > 3000 || expanded > 50 * 1024 * 1024)
        throw new Error(
          "This Word document expands beyond the safe import size. Export a simpler copy or paste text.",
        );
      if (!zip.file("word/document.xml") || !zip.file("[Content_Types].xml"))
        throw new Error("This archive is not a supported Word document.");
      send("Reading Word paragraphs…");
      const mammoth = await import("mammoth/mammoth.browser");
      const value = await mammoth.extractRawText({ arrayBuffer: bytes.buffer });
      result.text = value.value;
      result.warnings = [
        "Original styling is replaced by your chosen template. Review role boundaries and dates.",
      ];
    } else if (ext === "txt" || ext === "md") {
      try {
        result.text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      } catch {
        throw new Error(
          "Save this text file as UTF-8, or paste the text instead.",
        );
      }
    } else if (ext === "png" || ext === "jpg" || ext === "jpeg") {
      if (!(
        (bytes[0] === 0x89 && bytes[1] === 0x50) ||
        (bytes[0] === 0xff && bytes[1] === 0xd8)
      ))
        throw new Error("Choose a valid PNG or JPEG image.");
      result.scanPages = [1];
      result.warnings = ["This image needs scan recognition before review."];
    } else
      throw new Error(
        "Choose PDF, DOCX, TXT, PNG or JPEG. Export legacy Word or Pages documents to DOCX first.",
      );
    if (result.text.length > 500_000)
      throw new Error(
        "The extracted text is too large for a résumé. Import a shorter document.",
      );
    self.postMessage({ result });
  } catch (error) {
    self.postMessage({
      error:
        (error as Error).name === "PasswordException"
          ? "This PDF is password-protected. Unlock a copy on your device, then import it again."
          : (error as Error).message || "Unable to read this file.",
    });
  }
};
