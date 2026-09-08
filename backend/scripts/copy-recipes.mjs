// Copies the portal automation recipe JSONs into dist/ after tsc.
// tsc does not copy .json assets, and production runs from dist/src —
// without this, listRecipes()/loadRecipe() find nothing at runtime and the
// agent truthfully (but wrongly) reports "no automation recipes".
import { cp, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = resolve(__dirname, '..', 'src', 'services', 'portalAutomation', 'recipes');
const dest = resolve(__dirname, '..', 'dist', 'src', 'services', 'portalAutomation', 'recipes');

await rm(dest, { recursive: true, force: true });
await mkdir(dirname(dest), { recursive: true });
await cp(src, dest, { recursive: true });
process.stdout.write(`copied recipes: ${src} -> ${dest}\n`);
