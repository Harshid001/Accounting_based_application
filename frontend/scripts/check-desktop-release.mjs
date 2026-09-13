import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const readText = (relativePath) => readFileSync(join(repositoryRoot, relativePath), 'utf8');

const desktopVersion = JSON.parse(readText('frontend/src-tauri/tauri.conf.json')).version;
const cargoVersion = readText('frontend/src-tauri/Cargo.toml').match(/^version = "(.+)"$/m)?.[1];
const backendVersion = readText('backend/src/config/env.ts').match(
  /DESKTOP_VERSION = '([^']+)'/,
)?.[1];
const fallbackAgentVersion = readText('frontend/src/hooks/useWorkstationAgent.ts').match(
  /appVersion = '([^']+)'/,
)?.[1];

if (!desktopVersion || !cargoVersion || !backendVersion || !fallbackAgentVersion) {
  throw new Error('Unable to find every required desktop version field.');
}

const versions = { desktopVersion, cargoVersion, backendVersion, fallbackAgentVersion };
const mismatches = Object.entries(versions).filter(([, version]) => version !== desktopVersion);

if (mismatches.length > 0) {
  const details = mismatches.map(([field, version]) => `${field}: ${version}`).join(', ');
  throw new Error(
    `Desktop release metadata drifted. Expected ${desktopVersion}; found ${details}.`,
  );
}

if (!/^\d+\.\d+\.\d+$/.test(desktopVersion)) {
  throw new Error(`Desktop release version must be strict semver: ${desktopVersion}`);
}
