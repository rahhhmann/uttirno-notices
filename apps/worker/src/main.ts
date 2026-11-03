import { loadServerEnvironment } from '@uttirno/env';
if (process.argv[2] !== 'check-config') {
  console.error('Usage: worker check-config. Queue execution is not enabled in M1.');
  process.exitCode = 2;
} else {
  try {
    loadServerEnvironment();
    console.log('worker configuration valid; no source requests or jobs executed.');
  } catch {
    console.error('worker configuration invalid; run the documented environment checks.');
    process.exitCode = 1;
  }
}
