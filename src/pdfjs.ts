// Keep the display library and worker on the same compatibility build.
// The modern build assumes browser APIs that are missing in older Safari.
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import workerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";
pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
export const pdfOptions = () => ({
  cMapUrl: new URL(
    `${import.meta.env.BASE_URL}pdf-assets/cmaps/`,
    self.location.origin,
  ).href,
  cMapPacked: true,
  standardFontDataUrl: new URL(
    `${import.meta.env.BASE_URL}pdf-assets/standard_fonts/`,
    self.location.origin,
  ).href,
  wasmUrl: new URL(
    `${import.meta.env.BASE_URL}pdf-assets/wasm/`,
    self.location.origin,
  ).href,
});
export { pdfjs };
