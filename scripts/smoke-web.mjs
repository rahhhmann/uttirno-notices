import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

async function smokeWeb() {
  const name = process.argv[2];
  assert.ok(name === 'portal' || name === 'admin');
  const title = name === 'portal' ? 'উত্তীর্ণ চাকরির পোর্টাল' : 'উত্তীর্ণ প্রশাসন';
  const dir = path.resolve('apps', name);
  const require = createRequire(path.join(dir, 'package.json'));
  const { default: next } = await import(pathToFileURL(require.resolve('next')).href);
  const app = next({ dev: false, dir });
  await app.prepare();
  const server = createServer(app.getRequestHandler());
  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const response = await fetch(`http://127.0.0.1:${address.port}`);
    assert.equal(response.status, 200);
    assert.ok((await response.text()).includes(title), `Missing ${name} title`);
    console.log(`Built ${name} HTTP smoke passed with Bangla foundation notice.`);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    await app.close();
  }
}

// Next installs exception handlers. Explicitly catch failures so CI cannot report false success.
smokeWeb().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Web smoke failed');
  process.exitCode = 1;
});
