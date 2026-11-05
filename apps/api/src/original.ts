import { open, lstat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
// Only a DB-authorized hash reaches here; never accept a client path/URL.
export async function readOriginal(root: string, sha256: string, size: number) {
  if (!/^[a-f0-9]{64}$/.test(sha256) || size < 1 || size > 10485760)
    throw new Error('INVALID_ARCHIVE_RECEIPT');
  const folder = path.resolve(root, 'bytes'),
    file = path.join(folder, sha256);
  if ((await lstat(folder)).isSymbolicLink() || (await lstat(file)).isSymbolicLink())
    throw new Error('INVALID_ARCHIVE_LINK');
  const handle = await open(file, 'r');
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size !== size) throw new Error('INVALID_ARCHIVE_SIZE');
    const bytes = Buffer.alloc(size + 1);
    let offset = 0;
    while (offset < bytes.length) {
      const r = await handle.read(bytes, offset, bytes.length - offset, offset);
      if (!r.bytesRead) break;
      offset += r.bytesRead;
    }
    const value = bytes.subarray(0, offset);
    if (offset !== size || createHash('sha256').update(value).digest('hex') !== sha256)
      throw new Error('INVALID_ARCHIVE_HASH');
    return value;
  } finally {
    await handle.close();
  }
}
