/**
 * Test-only i18n wrapper — mounts the real `NextIntlClientProvider` with
 * the EN catalog so component tests exercise the same `useTranslations`
 * path as production. Avoids mocking `next-intl` (which would hide
 * regressions in ICU message shapes or missing keys).
 *
 * Usage:
 *   import { renderWithIntl } from "@/test-fixtures/i18n";
 *   renderWithIntl(<MyComponent />);
 *
 * Pass `wrapper` to nest your own provider tree — `renderWithIntl`
 * composes it inside the intl provider.
 */

import type { ReactElement, ReactNode } from "react";
import { render, type RenderOptions, type RenderResult } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import messages from "../../messages/en.json";

interface IntlRenderOptions extends Omit<RenderOptions, "wrapper"> {
  /** Extra provider layered inside the intl provider (e.g. RehydrateProvider). */
  wrapper?: (props: { children: ReactNode }) => ReactElement;
}

/**
 * `timeZone="UTC"` is hardcoded to keep ICU date/time formatting
 * deterministic across developer machines and CI (which may run in
 * different tz). Without it, next-intl emits a runtime warning and
 * date-formatted snapshots drift depending on the host tz.
 */
export function IntlWrapper({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
      {children}
    </NextIntlClientProvider>
  );
}

export function renderWithIntl(
  ui: ReactElement,
  options: IntlRenderOptions = {},
): RenderResult {
  const { wrapper: Inner, ...rest } = options;
  const Wrapper = ({ children }: { children: ReactNode }) =>
    Inner ? (
      <IntlWrapper>
        <Inner>{children}</Inner>
      </IntlWrapper>
    ) : (
      <IntlWrapper>{children}</IntlWrapper>
    );
  return render(ui, { wrapper: Wrapper, ...rest });
}
