import { existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Regression guard: production runs `node dist/src/server.js` and tsc does
// NOT copy .json assets — the copy-recipes.mjs build step exists for this.
// If it is removed or breaks, listRecipes() returns [] in production and the
// agent truthfully reports "automation fully down" with recipes present in src.
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const recipesSrc = join(repoRoot, 'src', 'services', 'portalAutomation', 'recipes');
const recipesDist = join(repoRoot, 'dist', 'src', 'services', 'portalAutomation', 'recipes');

describe('build artifacts — automation recipes', () => {
  it('keeps the shipped recipe JSONs in src', () => {
    expect(existsSync(resolve(recipesSrc, 'gst', 'gstr-1.json'))).toBe(true);
    expect(existsSync(resolve(recipesSrc, 'gst', 'gstr-3b.json'))).toBe(true);
    expect(existsSync(resolve(recipesSrc, 'demo', 'fixture.json'))).toBe(true);
  });

  it('copies recipes into dist after npm run build (copy-recipes.mjs step)', () => {
    // Skipped until the first production build runs in this checkout;
    // CI/deploy always builds first so the assertion holds there.
    if (!existsSync(resolve(repoRoot, 'dist'))) return;
    expect(existsSync(resolve(recipesDist, 'gst', 'gstr-1.json'))).toBe(true);
    expect(existsSync(resolve(recipesDist, 'gst', 'gstr-3b.json'))).toBe(true);
    expect(existsSync(resolve(recipesDist, 'demo', 'fixture.json'))).toBe(true);
  });
});
