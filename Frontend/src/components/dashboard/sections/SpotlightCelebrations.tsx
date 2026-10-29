import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { SparklesCelebration } from "../../common/SparklesCelebration";
import { api } from "@/lib/api";

/**
 * Plays every spotlight's celebration once per dashboard visit, one after another.
 * Mounted at dashboard level (not inside the Employee Performance section) so it runs
 * for every logged-in employee, whatever dashboard sections their permissions allow.
 */
export function SpotlightCelebrations() {
  const [styles, setStyles] = useState<string[]>([]);
  const [idx, setIdx] = useState(0);
  const loaded = useRef(false);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    (async () => {
      try {
        const res = await api.get<any>("/dashboard/spotlights", { showErrorToast: false, showLoader: false });
        const list: any[] = Array.isArray(res?.spotlights) ? res.spotlights : [];
        setStyles(list.map((s) => s?.popperStyle).filter((p) => p && p !== "none"));
      } catch {
        // celebrations are optional
      }
    })();
  }, []);

  if (typeof document === "undefined" || idx >= styles.length) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] pointer-events-none">
      <SparklesCelebration
        key={`celebrate-${idx}`}
        trigger={true}
        effectStyle={styles[idx] ?? "poppers"}
        onComplete={() => setIdx((i) => i + 1)}
      />
    </div>,
    document.body
  );
}
