import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const frontendRoot = process.cwd();
const repositoryRoot = join(frontendRoot, '..');
const readRepositoryFile = (path: string): string =>
  readFileSync(join(repositoryRoot, path), 'utf8');

const tauriVersion = JSON.parse(readRepositoryFile('frontend/src-tauri/tauri.conf.json')).version;
const cargoVersion = readRepositoryFile('frontend/src-tauri/Cargo.toml').match(
  /^version = "(.+)"$/m,
)?.[1];
const backendVersion = readRepositoryFile('backend/src/config/env.ts').match(
  /DESKTOP_VERSION = '([^']+)'/,
)?.[1];
const fallbackAgentVersion = readRepositoryFile('frontend/src/hooks/useWorkstationAgent.ts').match(
  /appVersion = '([^']+)'/,
)?.[1];

describe('desktop release metadata', () => {
  it('keeps every desktop version source aligned', () => {
    expect({ tauriVersion, cargoVersion, backendVersion, fallbackAgentVersion }).toEqual({
      tauriVersion,
      cargoVersion: tauriVersion,
      backendVersion: tauriVersion,
      fallbackAgentVersion: tauriVersion,
    });
  });

  it('uses strict semver for release tags', () => {
    expect(tauriVersion).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
