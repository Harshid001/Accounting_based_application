import { getAuth, initAuth } from '../src/config/auth.js';
import { connectDatabase, disconnectDatabase } from '../src/config/db.js';

const signIn = async (email: string, password: string, role: 'admin' | 'staff'): Promise<void> => {
  const result = await getAuth().api.signInEmail({ body: { email, password } });
  const user = result?.user as { role?: string; email?: string } | undefined;
  if (!result?.token || user?.role !== role || user.email !== email) {
    throw new Error('Desktop credential smoke test failed for ' + email);
  }
  console.log('pass ' + email + ' role=' + role);
};

const run = async (): Promise<void> => {
  await connectDatabase();
  initAuth();
  const adminPassword = process.env.ADMIN_TEST_PASSWORD;
  const staffPassword = process.env.STAFF_TEST_PASSWORD;
  if (adminPassword === undefined || staffPassword === undefined) {
    throw new Error('Set ADMIN_TEST_PASSWORD and STAFF_TEST_PASSWORD before running this smoke test.');
  }
  await signIn('harshidsoni01@gmail.com', adminPassword, 'admin');
  await signIn('staff@gmail.com', staffPassword, 'staff');
  await disconnectDatabase();
};

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
