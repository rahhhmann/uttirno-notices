import { parseServerEnvironment } from '@uttirno/env';
import { checkDependencies } from '@uttirno/infrastructure';
try {
  process.loadEnvFile('.env');
} catch {
  /* Environment may be injected by CI. */
}
const results = await checkDependencies(parseServerEnvironment(process.env));
console.log(JSON.stringify(results));
if (!Object.values(results).every(Boolean)) process.exitCode = 1;
