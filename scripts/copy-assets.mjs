import { mkdir, cp, readdir, copyFile } from "node:fs/promises";
import path from "node:path";
const root = process.cwd();
await mkdir("public/fonts", { recursive: true });
for (const family of ["inter", "source-serif-4"]) {
  const dir = path.join(root, "node_modules/@fontsource", family, "files");
  for (const weight of [400, 600, 700]) {
    const file = `${family}-latin-${weight}-normal.woff`;
    await copyFile(path.join(dir, file), path.join("public/fonts", file));
  }
  await copyFile(
    path.join(root, "node_modules/@fontsource", family, "LICENSE"),
    `public/fonts/${family}-LICENSE.txt`,
  );
}
await mkdir("public/ocr/core", { recursive: true });
await copyFile(
  "node_modules/tesseract.js/dist/worker.min.js",
  "public/ocr/worker.min.js",
);
for (const f of await readdir("node_modules/tesseract.js-core")) {
  if (/\.wasm(?:\.js)?$/.test(f))
    await copyFile(
      `node_modules/tesseract.js-core/${f}`,
      `public/ocr/core/${f}`,
    );
}
await cp(
  "node_modules/@tesseract.js-data/eng/4.0.0_best_int",
  "public/ocr/lang",
  { recursive: true },
);
await mkdir("public/pdf-assets", { recursive: true });
for (const dir of ["cmaps", "standard_fonts", "wasm"])
  await cp(`node_modules/pdfjs-dist/${dir}`, `public/pdf-assets/${dir}`, {
    recursive: true,
  });
console.log("Local fonts, PDF resources and OCR assets are ready.");
