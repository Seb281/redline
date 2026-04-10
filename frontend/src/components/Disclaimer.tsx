/** Legal disclaimer banner — displayed on the report screen. */

export function Disclaimer() {
  return (
    <div className="mt-9 mx-auto max-w-2xl border-l-[3px] border-[var(--border-secondary)] bg-[var(--bg-secondary)] px-5 py-3.5 text-[15px] italic text-[var(--text-tertiary)] font-[var(--font-heading)] theme-transition">
      This tool provides analysis only — not legal advice. Consult a qualified
      lawyer before making legal decisions.
    </div>
  );
}
