/** Legal disclaimer banner — displayed on every screen. */

export function Disclaimer() {
  return (
    <div className="mt-8 mx-auto max-w-2xl border-l-[3px] border-[var(--border-secondary)] bg-[var(--bg-secondary)] px-4 py-3 text-sm text-[var(--text-tertiary)] theme-transition">
      This tool provides analysis only — not legal advice. Consult a qualified
      lawyer before making legal decisions.
    </div>
  );
}
