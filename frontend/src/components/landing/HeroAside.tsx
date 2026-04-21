/**
 * HeroAside — three-row aside right of the hero upload block.
 *
 * Rows: "Reads from", "Watches for", "Flags against". Each row is a
 * mono kicker + a Newsreader sentence enumerating what the analyser
 * covers. Pure presentation, all content i18n-backed.
 */

import { useTranslations } from "next-intl";
import { MonoLabel } from "@/components/ui/MonoLabel";

export function HeroAside() {
  const t = useTranslations("Landing.HeroAside");
  const rows = [
    { kicker: t("readsKicker"), body: t("readsBody") },
    { kicker: t("watchesKicker"), body: t("watchesBody") },
    { kicker: t("flagsKicker"), body: t("flagsBody") },
  ];
  return (
    <aside className="flex flex-col divide-y divide-paper-edge border-t border-paper-edge">
      {rows.map((row) => (
        <div key={row.kicker} className="py-5">
          <MonoLabel tone="red" className="block mb-2">
            {row.kicker}
          </MonoLabel>
          <p className="t-reading text-ink-2 m-0">{row.body}</p>
        </div>
      ))}
    </aside>
  );
}
