import crypto from "node:crypto";
import zlib from "node:zlib";

const ALG = "aes-256-gcm";
const ENVELOPE_VERSION = 1;

/**
 * Encrypts a JSON-serializable payload into the same .lzb envelope format
 * used by the terminal admin console (AES-256-GCM, scrypt-derived key,
 * gzipped payload). Returns a Buffer of the envelope JSON.
 */
export function encryptBackup(payload, passphrase) {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = crypto.scryptSync(passphrase, salt, 32);
  const cipher = crypto.createCipheriv(ALG, key, iv);

  const compressed = zlib.gzipSync(Buffer.from(JSON.stringify(payload), "utf8"));
  const ciphertext = Buffer.concat([cipher.update(compressed), cipher.final()]);
  const tag = cipher.getAuthTag();

  const envelope = {
    v: ENVELOPE_VERSION,
    alg: ALG,
    gz: true,
    salt: salt.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    data: ciphertext.toString("base64")
  };
  return Buffer.from(JSON.stringify(envelope), "utf8");
}

/**
 * Decrypts an .lzb envelope (Buffer or string). Throws on a wrong passphrase,
 * tampered data, or an invalid envelope.
 */
export function decryptBackup(envelope, passphrase) {
  const parsed = typeof envelope === "string" ? JSON.parse(envelope) : JSON.parse(envelope.toString("utf8"));
  if (
    !parsed ||
    parsed.v !== ENVELOPE_VERSION ||
    parsed.alg !== ALG ||
    typeof parsed.salt !== "string" ||
    typeof parsed.iv !== "string" ||
    typeof parsed.tag !== "string" ||
    typeof parsed.data !== "string"
  ) {
    throw new Error("Not a valid Life Planner backup file");
  }

  const key = crypto.scryptSync(passphrase, Buffer.from(parsed.salt, "base64"), 32);
  const decipher = crypto.createDecipheriv(ALG, key, Buffer.from(parsed.iv, "base64"));
  decipher.setAuthTag(Buffer.from(parsed.tag, "base64"));

  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(parsed.data, "base64")),
    decipher.final()
  ]);
  const decompressed = parsed.gz ? zlib.gunzipSync(plaintext) : plaintext;
  const payload = JSON.parse(decompressed.toString("utf8"));

  if (!payload || !Array.isArray(payload.tables)) {
    throw new Error("Backup contains no table data");
  }
  return payload;
}
