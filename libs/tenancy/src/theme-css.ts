import { ThemeTokens } from './tenant-config';

const RADII: Record<ThemeTokens['radius'], string> = {
  none: '0px', sm: '4px', md: '8px', lg: '14px', full: '9999px',
};

/**
 * Render tenant tokens as CSS custom properties consumed by libs/ui. Injected per request,
 * so one deployment serves any number of differently branded stores.
 */
export function themeToCss(theme: ThemeTokens): string {
  const light = {
    '--ls-color-primary': theme.colorPrimary,
    '--ls-color-on-primary': theme.colorOnPrimary,
    '--ls-color-accent': theme.colorAccent ?? theme.colorPrimary,
    '--ls-color-bg': theme.colorBackground,
    '--ls-color-surface': theme.colorSurface,
    '--ls-color-text': theme.colorText,
    '--ls-color-text-muted': theme.colorTextMuted,
    '--ls-radius': RADII[theme.radius],
    '--ls-font': theme.fontFamily,
  };
  const dark = {
    '--ls-color-bg': theme.dark?.colorBackground ?? '#0E0E11',
    '--ls-color-surface': theme.dark?.colorSurface ?? '#1A1A1F',
    '--ls-color-text': theme.dark?.colorText ?? '#F2F2F5',
    '--ls-color-text-muted': theme.dark?.colorTextMuted ?? '#A0A0AB',
  };
  const decl = (vars: Record<string, string>) =>
    Object.entries(vars).map(([k, v]) => `${k}:${sanitize(v)};`).join('');
  return (
    `:root{${decl(light)}}` +
    `@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){${decl(dark)}}}` +
    `:root[data-theme="dark"]{${decl(dark)}}`
  );
}

/** Tenant input ends up in a <style> tag — strip anything that could break out of a declaration. */
function sanitize(value: string): string {
  return value.replace(/[<>{};]/g, '');
}
