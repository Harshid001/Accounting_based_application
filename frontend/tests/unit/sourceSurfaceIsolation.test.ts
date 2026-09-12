import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const sourceFiles = (root: string): string[] =>
  readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : [path];
  });

const contentsOf = (root: string): Array<{ path: string; text: string }> =>
  sourceFiles(root)
    .filter((path) => /\.(tsx|ts)$/.test(path))
    .map((path) => ({ path, text: readFileSync(path, 'utf8') }));

describe('source surface isolation', () => {
  it('keeps admin and staff imports out of the website source', () => {
    expect(contentsOf('src/website')).toEqual(
      expect.arrayContaining([expect.not.objectContaining({ text: expect.stringContaining('@/desktop/') })]),
    );
  });

  it('keeps client portal and landing imports out of the desktop source', () => {
    expect(contentsOf('src/desktop')).toEqual(
      expect.arrayContaining([
        expect.not.objectContaining({ text: expect.stringContaining('@/website/') }),
      ]),
    );
  });
});
