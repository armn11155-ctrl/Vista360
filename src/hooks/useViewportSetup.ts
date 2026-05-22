// @ts-nocheck — legacy file: migrating to strict TypeScript gradually
import { useEffect } from "react";
import { T } from "../config/theme";

export function useViewportSetup() {
  useEffect(() => {
    try {
      const setMeta = (name: string, content: string) => {
        let el = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
        if (!el) { el = document.createElement("meta"); el.name = name; document.head.appendChild(el); }
        el.setAttribute("content", content);
      };
      if (!document.querySelector('link[href*="fonts.googleapis.com"]')) {
        const pc1 = document.createElement("link"); pc1.rel = "preconnect"; pc1.href = "https://fonts.googleapis.com";
        document.head.appendChild(pc1);
        const pc2 = document.createElement("link"); pc2.rel = "preconnect"; pc2.href = "https://fonts.gstatic.com";
        pc2.crossOrigin = "anonymous"; document.head.appendChild(pc2);
        const fl = document.createElement("link"); fl.rel = "stylesheet";
        fl.href = "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=Barlow+Condensed:wght@700;800;900&display=swap";
        document.head.appendChild(fl);
      }
      setMeta("viewport","width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no");
      setMeta("apple-mobile-web-app-capable","yes");
      setMeta("apple-mobile-web-app-status-bar-style","default");
      setMeta("apple-mobile-web-app-title","Vista360");
      setMeta("mobile-web-app-capable","yes");
      setMeta("theme-color", T.bg);
      setMeta("format-detection","telephone=no");
    } catch { /* silencioso */ }
  }, []);
}
