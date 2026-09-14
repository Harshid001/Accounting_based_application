import { Types } from 'mongoose';
import { describe, expect, it } from 'vitest';

import {
  enqueueAppLaunch,
  enqueueFilesystemOperation,
  enqueueProcessAction,
  enqueueShellCommand,
  LAUNCHABLE_APPS,
  MAX_LOCAL_FILE_BYTES,
  READ_ONLY_COMMANDS,
} from '../../src/services/workstationControls.service.js';
import type { RequestActor } from '../../src/types/context.js';

const mockUserId = new Types.ObjectId();
const mockActor: RequestActor = {
  id: mockUserId,
  role: 'admin',
  ip: '127.0.0.1',
  userAgent: 'vitest',
  requestId: null,
};

describe('workstationControls constants and guards', () => {
  it('allowlists only safe terminal shells', () => {
    expect(READ_ONLY_COMMANDS.has('powershell.exe')).toBe(true);
    expect(READ_ONLY_COMMANDS.has('pwsh.exe')).toBe(true);
    expect(READ_ONLY_COMMANDS.has('cmd.exe')).toBe(true);
    expect(READ_ONLY_COMMANDS.has('bash')).toBe(false);
    expect(READ_ONLY_COMMANDS.has('sh')).toBe(false);
  });

  it('allowlists permitted desktop apps', () => {
    expect(LAUNCHABLE_APPS.get('chrome')).toBe('chrome.exe');
    expect(LAUNCHABLE_APPS.get('edge')).toBe('msedge.exe');
    expect(LAUNCHABLE_APPS.get('excel')).toBe('excel.exe');
    expect(LAUNCHABLE_APPS.get('tally')).toBe('tally.exe');
    expect(LAUNCHABLE_APPS.get('calculator')).toBe('calc.exe');
    expect(LAUNCHABLE_APPS.get('notepad')).toBe('notepad.exe');
    expect(LAUNCHABLE_APPS.get('malware')).toBeUndefined();
  });

  it('rejects un-allowlisted shells before database lookups', async () => {
    await expect(
      enqueueShellCommand(mockUserId, mockActor, { command: 'bash.exe' }),
    ).rejects.toThrow('Only PowerShell or CMD can be queued.');
  });

  it('rejects destructive commands in shell arguments', async () => {
    await expect(
      enqueueShellCommand(mockUserId, mockActor, {
        command: 'powershell.exe',
        arguments: ['-Command', 'Remove-Item C:\\Windows\\System32'],
      }),
    ).rejects.toThrow('Terminal control is read-only.');

    await expect(
      enqueueShellCommand(mockUserId, mockActor, {
        command: 'cmd.exe',
        arguments: ['/c', 'del /f /q *.*'],
      }),
    ).rejects.toThrow('Terminal control is read-only.');
  });

  it('rejects non-allowlisted application launch requests', async () => {
    await expect(
      enqueueAppLaunch(mockUserId, mockActor, { application: 'powershell' }),
    ).rejects.toThrow('That application is not allowlisted.');
  });

  it('refuses non-HTTPS URLs for browser launch', async () => {
    await expect(
      enqueueAppLaunch(mockUserId, mockActor, {
        application: 'chrome',
        url: 'http://insecure-site.com',
      }),
    ).rejects.toThrow('Launch URLs must use HTTPS.');
  });

  it('refuses process termination without confirmation gate', async () => {
    await expect(
      enqueueProcessAction(mockUserId, mockActor, { action: 'terminate' }),
    ).rejects.toThrow('Process termination is disabled until a confirmation gate exists.');
  });

  it('refuses local files exceeding maximum byte boundary', async () => {
    const hugeContent = 'A'.repeat(MAX_LOCAL_FILE_BYTES + 10);
    await expect(
      enqueueFilesystemOperation(mockUserId, mockActor, {
        operation: 'write',
        path: 'C:\\test.txt',
        content: hugeContent,
      }),
    ).rejects.toThrow('Local files are limited to 512 KB.');
  });
});
