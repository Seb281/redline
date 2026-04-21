/**
 * Toggle — 42×22 rectangular switch used by the Account privacy panel.
 *
 * Deliberately rectangular (not pill-shaped) so it matches the
 * document-like aesthetic: ink / paper contrast, 1px ink border,
 * 20px slide when on. Keyboard-accessible via the underlying
 * `<button role="switch">`.
 */

import type { ButtonHTMLAttributes } from "react";

export interface ToggleProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: string;
}

export function Toggle({
  checked,
  onChange,
  label,
  className = "",
  ...rest
}: ToggleProps) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-block h-[22px] w-[42px] border transition-colors duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ink ${
        checked
          ? "bg-ink border-ink"
          : "bg-paper border-paper-edge hover:border-ink"
      } ${className}`}
      {...rest}
    >
      <span
        aria-hidden
        className={`absolute top-[2px] h-[16px] w-[16px] transition-transform duration-150 ${
          checked
            ? "translate-x-[22px] bg-paper"
            : "translate-x-[2px] bg-ink"
        }`}
      />
    </button>
  );
}
