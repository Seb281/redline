/**
 * Locale-aware navigation primitives.
 *
 * All intra-app navigation (`<Link>`, `router.push`, `redirect`, etc.)
 * MUST go through these re-exports so the active locale is preserved on
 * every hop. Importing directly from `next/link` or `next/navigation`
 * bypasses next-intl and will drop the `/fr`, `/de`, etc. segment.
 */

import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
