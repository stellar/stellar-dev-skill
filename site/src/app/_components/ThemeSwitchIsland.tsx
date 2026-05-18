"use client";

import { ThemeSwitch } from "@stellar/design-system";

const LOCAL_STORAGE_SAVED_THEME = "stellarTheme:Laboratory";

/**
 * Client island for the design system's ThemeSwitch. The wrapping div has
 * `suppressHydrationWarning` because ThemeSwitch reads localStorage on
 * first render — its post-hydration UI legitimately differs from the SSR
 * placeholder when a saved theme exists. The wrapper reserves a slot in
 * the static HTML so there's no header CLS bump.
 */
export const ThemeSwitchIsland = () => {
  return (
    <div suppressHydrationWarning>
      <ThemeSwitch storageKeyId={LOCAL_STORAGE_SAVED_THEME} />
    </div>
  );
};
