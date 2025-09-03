import { log } from '@/lib/logger';
import { exec } from 'child_process';

// TODO: don't run prisma cli
export async function runMigrations() {
  try {
    await new Promise((res, rej) => {
      const proc = exec('pnpm prisma migrate deploy');

      proc.stdout?.on('data', (data) => {
        process.stdout.write(data);
      });

      proc.stderr?.on('data', (data) => {
        process.stderr.write(data);
      });

      proc.on('close', (code) => {
        if (code !== 0) {
          rej(new Error('Migration process exited with code ' + code));
        } else {
          res(true);
        }
      });
    });
  } catch (e) {
    log('db').error('Error running migrations: ' + e);
    process.exit(1);
  }
}
