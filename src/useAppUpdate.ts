import { useEffect, useState } from "react";
import { enableOffline, isOfflineEnabled } from "./offline";
export function useAppUpdate() {
  const [available, setAvailable] = useState(false),
    [registration, setRegistration] =
      useState<ServiceWorkerRegistration | null>(null);
  useEffect(() => {
    if (import.meta.env.DEV) return;
    let active = true,
      checking = false;
    const cleanups: (() => void)[] = [];
    const check = async () => {
      if (
        checking ||
        !navigator.onLine ||
        document.visibilityState === "hidden"
      )
        return;
      checking = true;
      try {
        const response = await fetch(
          `${import.meta.env.BASE_URL}version.json?t=${Date.now()}`,
          { cache: "no-store" },
        );
        if (response.ok) {
          const data = await response.json();
          if (
            active &&
            typeof data.version === "string" &&
            data.version !== __APP_BUILD__
          )
            setAvailable(true);
        }
      } catch {
      } finally {
        checking = false;
      }
    };
    if (isOfflineEnabled())
      void enableOffline()
        .then((reg) => {
          if (!active) return;
          setRegistration(reg);
          if (reg.waiting) setAvailable(true);
          const found = () => {
            const worker = reg.installing;
            if (!worker) return;
            const state = () => {
              if (
                active &&
                worker.state === "installed" &&
                navigator.serviceWorker.controller
              )
                setAvailable(true);
            };
            worker.addEventListener("statechange", state);
            cleanups.push(() =>
              worker.removeEventListener("statechange", state),
            );
          };
          reg.addEventListener("updatefound", found);
          cleanups.push(() => reg.removeEventListener("updatefound", found));
          void reg.update().catch(() => {});
        })
        .catch(() => {});
    const onFocus = () => void check();
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    const timer = setInterval(onFocus, 5 * 60_000);
    void check();
    return () => {
      active = false;
      clearInterval(timer);
      cleanups.forEach((fn) => fn());
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, []);
  const activate = async () => {
    const waiting = registration?.waiting;
    if (waiting)
      await new Promise<void>((resolve, reject) => {
        const done = () => {
          clearTimeout(timer);
          navigator.serviceWorker.removeEventListener("controllerchange", done);
          resolve();
        };
        const timer = setTimeout(() => {
          navigator.serviceWorker.removeEventListener("controllerchange", done);
          reject(
            new Error(
              "The update is still preparing. Your draft is saved; try again shortly.",
            ),
          );
        }, 15_000);
        navigator.serviceWorker.addEventListener("controllerchange", done, {
          once: true,
        });
        waiting.postMessage({ type: "SKIP_WAITING" });
      });
    location.reload();
  };
  return { available, activate };
}
