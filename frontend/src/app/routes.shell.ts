/**
 * Default alias resolution for `@/app/routes.shell` (web build). Vite's
 * config-time alias in vite.config.ts points this module at the correct
 * shell table per build; this file is the fallback so TypeScript and
 * vitest (which don't run the Vite alias) always resolve it to the web
 * table — desktop test runs stub VITE_APP_SHELL and still exercise the
 * desktop table through their own imports.
 */
export { ShellRoutes } from '../website/routes';
