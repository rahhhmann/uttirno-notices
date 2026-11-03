import { loadServerEnvironment } from '@uttirno/env';
import { checkDependencies } from '@uttirno/infrastructure';
import { createApp } from './app.js';
const env = loadServerEnvironment();
const app = createApp(() => checkDependencies(env));
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.once(signal, () => {
    void app.close();
  });
await app.listen({ host: env.HOST, port: env.PORT });
console.log('Uttirno API foundation listening on configured host/port.');
