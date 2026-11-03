import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export default {
  poweredByHeader: false,
  outputFileTracingRoot: root,
  transpilePackages: ['@uttirno/ui'],
  experimental: { cpus: 2 },
};
