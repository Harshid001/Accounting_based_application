export const MIN_PASSWORD_LENGTH = 12;
export const MAX_PASSWORD_LENGTH = 128;

const COMMON_PASSWORDS = new Set([
  '123456789012',
  '1234567890123',
  '12345678901234',
  '123456789012345',
  'passwordpassword',
  'password123456',
  'password1234',
  'passw0rdpassw0rd',
  'qwertyuiopas',
  'qwertyuiop123',
  'iloveyou1234',
  'letmein12345',
  'welcome12345',
  'administrator',
  'adminadmin12',
  'abcd12345678',
  'abcdefghijkl',
  'aaaaaaaaaaaa',
  '000000000000',
  '111111111111',
  'trustno1trust',
  'monkeymonkey',
  'dragondragon',
  'sunshine1234',
  'princess1234',
  'football1234',
  'baseball1234',
  'superman1234',
  'starwars1234',
  'whatever1234',
  'qazwsxedcrfv',
  'zaq12wsxcde3',
  '1qaz2wsx3edc',
  'asdfghjkl123',
  'zxcvbnm12345',
  'changeme1234',
  'secretsecret',
  'accountant12',
  'firmdesk1234',
  'india@123456',
  'bharat@12345',
  'welcome@1234',
  'password@123',
  'admin@123456',
]);

const SEQUENCES = ['0123456789', 'abcdefghijklmnopqrstuvwxyz', 'qwertyuiop', 'asdfghjkl'];

const hasLongRun = (value: string): boolean => /(.)\1{5,}/.test(value);

const hasLongSequence = (value: string): boolean => {
  const lower = value.toLowerCase();
  for (const sequence of SEQUENCES) {
    for (let index = 0; index + 7 <= sequence.length; index += 1) {
      const chunk = sequence.slice(index, index + 7);
      if (lower.includes(chunk)) return true;
      if (lower.includes([...chunk].reverse().join(''))) return true;
    }
  }
  return false;
};

const distinctCharacters = (value: string): number => new Set(value).size;

export interface PasswordVerdict {
  ok: boolean;
  message: string;
}

export const checkPassword = (password: string, context: string[] = []): PasswordVerdict => {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      ok: false,
      message: `Use at least ${MIN_PASSWORD_LENGTH} characters. A short phrase you can remember beats a short password you cannot.`,
    };
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return { ok: false, message: `Keep your password under ${MAX_PASSWORD_LENGTH} characters.` };
  }
  const lower = password.toLowerCase();
  if (COMMON_PASSWORDS.has(lower)) {
    return {
      ok: false,
      message: 'That password appears on public breach lists. Choose something only you would write.',
    };
  }
  if (hasLongRun(password)) {
    return { ok: false, message: 'Avoid repeating the same character six or more times.' };
  }
  if (hasLongSequence(password)) {
    return { ok: false, message: 'Avoid long keyboard or alphabet runs such as abcdefg or 1234567.' };
  }
  if (distinctCharacters(password) < 5) {
    return { ok: false, message: 'Use a wider mix of characters — this one repeats too few.' };
  }
  for (const value of context) {
    const trimmed = value.trim().toLowerCase();
    if (trimmed.length >= 4 && lower.includes(trimmed)) {
      return {
        ok: false,
        message: 'Your password must not contain your name or email address.',
      };
    }
  }
  return { ok: true, message: 'ok' };
};
