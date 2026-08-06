"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { updateViaCache: "none" })
        .then((registration) => registration.update())
        .catch(() => {
          // PWA 기능이 지원되지 않아도 핵심 판별 흐름은 계속 사용할 수 있습니다.
        });
    }
  }, []);

  return null;
}
