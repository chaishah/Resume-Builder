import { readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
async function walk(dir, prefix = "") {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (e.isDirectory())
      out.push(...(await walk(`${dir}/${e.name}`, `${prefix}${e.name}/`)));
    else out.push(`${prefix}${e.name}`);
  }
  return out;
}
const files = await walk("dist");
const assetFiles = files.filter(
  (f) =>
    !f.startsWith("ocr/") &&
    !["sw.js", "offline-ocr.json", ".nojekyll"].includes(f),
);
const version = createHash("sha256")
  .update(await readFile("dist/index.html"))
  .digest("hex")
  .slice(0, 16);
await writeFile(
  "dist/offline-ocr.json",
  JSON.stringify(files.filter((f) => f.startsWith("ocr/"))),
);
await writeFile("dist/.nojekyll", "");
await writeFile(
  "dist/sw.js",
  `const CACHE='resume-studio-${version}';
const ROOT=new URL('./',self.location.href);
const ASSETS=${JSON.stringify(assetFiles)};
self.addEventListener('install',event=>{event.waitUntil((async()=>{const cache=await caches.open(CACHE);for(const asset of ASSETS)await cache.add(new URL(asset,ROOT));})());});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith('resume-studio-')&&key!==CACHE&&key!=='resume-studio-ocr-v1')await caches.delete(key);await self.clients.claim();})());});
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting();});
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==ROOT.origin||!url.pathname.startsWith(ROOT.pathname))return;
event.respondWith((async()=>{if(event.request.mode==='navigate'){try{return await fetch(event.request);}catch{return await caches.match(new URL('index.html',ROOT))||Response.error();}}
const stored=await caches.match(event.request);if(stored)return stored;return fetch(event.request);})());});
`,
);
console.log(
  `Offline app shell ready (${assetFiles.length} files; scan assets opt-in).`,
);
