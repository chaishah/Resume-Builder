const KEY = "resume-studio-offline";
export const isOfflineEnabled = () => {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
};
export async function enableOffline() {
  if (!("serviceWorker" in navigator))
    throw new Error("Offline installation is not supported by this browser.");
  const reg = await navigator.serviceWorker.register(
    `${import.meta.env.BASE_URL}sw.js`,
    { scope: import.meta.env.BASE_URL },
  );
  if (!reg.active) {
    const worker = reg.installing || reg.waiting;
    if (worker && worker.state !== "installed" && worker.state !== "activated")
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(
          () =>
            reject(
              new Error(
                "Offline installation is still in progress. Stay connected and try again.",
              ),
            ),
          60000,
        );
        worker.addEventListener("statechange", () => {
          if (worker.state === "installed" || worker.state === "activated") {
            clearTimeout(timer);
            resolve();
          } else if (worker.state === "redundant") {
            clearTimeout(timer);
            reject(
              new Error(
                "Offline installation could not finish. Check the connection and try again.",
              ),
            );
          }
        });
      });
  }
  try {
    localStorage.setItem(KEY, "1");
  } catch {}
  return reg;
}
export async function disableOffline() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
  if ("serviceWorker" in navigator) {
    for (const r of await navigator.serviceWorker.getRegistrations())
      if (r.scope === new URL(import.meta.env.BASE_URL, location.origin).href)
        await r.unregister();
  }
  if ("caches" in window)
    for (const key of await caches.keys())
      if (key.startsWith("resume-studio-")) await caches.delete(key);
}
export async function clearAppData() {
  window.dispatchEvent(new Event("resume-studio:clear"));
  const { db } = await import("./storage");
  await db.delete();
  await disableOffline();
  try {
    for (const key of Object.keys(localStorage))
      if (key.startsWith("resume-studio-")) localStorage.removeItem(key);
  } catch {}
}
export async function cacheOCR(onProgress: (s: string) => void) {
  const root = import.meta.env.BASE_URL;
  const response = await fetch(`${root}offline-ocr.json`);
  if (!response.ok)
    throw new Error(
      "OCR download list is unavailable. Connect to the latest app and try again.",
    );
  const urls: string[] = await response.json();
  const cache = await caches.open("resume-studio-ocr-v1");
  for (let i = 0; i < urls.length; i++) {
    onProgress(`Saving scan tools ${i + 1} of ${urls.length}…`);
    await cache.add(`${root}${urls[i]}`);
  }
  onProgress("Scan recognition is ready offline.");
}
