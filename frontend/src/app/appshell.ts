/**
 * Default alias resolution for `@/app/appshell` (web build). Vite's
 * config-time alias in vite.config.ts points this module at the correct
 * shell chrome per build; this fallback keeps TypeScript and plain-node
 * tooling resolving.
 */
export { AppShell } from './appshell.web';
