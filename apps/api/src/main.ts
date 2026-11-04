import { loadServerEnvironment } from '@uttirno/env';
import { buildApplication } from './startup.js';
const env = loadServerEnvironment();
const app = await buildApplication(env);
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.once(signal, () => {
    void app.close();
  });
await app.listen({ host: env.HOST, port: env.PORT });
console.log('Uttirno API listening on configured host/port.');
