import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
// Raw logical dumps are never written to disk by the rehearsal. Key custody is external.
const magic = Buffer.from('UTTIRNO-BACKUP-v1\n');
export function encryptBackup(dump: Buffer, key: Buffer) {
  if (key.length !== 32 || dump.length === 0 || dump.length > 67108864)
    throw new Error('BACKUP_LIMIT_OR_KEY');
  const iv = randomBytes(12),
    cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(magic);
  const encrypted = Buffer.concat([cipher.update(dump), cipher.final()]);
  return Buffer.concat([magic, iv, cipher.getAuthTag(), encrypted]);
}
export function decryptBackup(bytes: Buffer, key: Buffer) {
  if (
    key.length !== 32 ||
    bytes.length < magic.length + 29 ||
    bytes.length > 67108928 ||
    !bytes.subarray(0, magic.length).equals(magic)
  )
    throw new Error('INVALID_BACKUP');
  const offset = magic.length,
    decipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(offset, offset + 12));
  decipher.setAAD(magic);
  decipher.setAuthTag(bytes.subarray(offset + 12, offset + 28));
  return Buffer.concat([decipher.update(bytes.subarray(offset + 28)), decipher.final()]);
}
