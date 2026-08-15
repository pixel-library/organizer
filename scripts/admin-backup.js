import crypto from "node:crypto";
import fs from "node:fs";
import zlib from "node:zlib";

const ALG = "aes-256-gcm";

export function encryptBackup(data, passphrase, outFile) {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = crypto.scryptSync(passphrase, salt, 32);
  const gz = zlib.gzipSync(Buffer.from(JSON.stringify(data), "utf8"));
  const cipher = crypto.createCipheriv(ALG, key, iv);
  const enc = Buffer.concat([cipher.update(gz), cipher.final()]);
  const envelope = {
    v: 1,
    alg: ALG,
    gz: true,
    salt: salt.toString("base64"),
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    data: enc.toString("base64")
  };
  fs.writeFileSync(outFile, JSON.stringify(envelope, null, 2));
  return outFile;
}

export function decryptBackup(file, passphrase) {
  let env;
  try {
    env = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    throw new Error("file is not a valid Life Organizer backup");
  }
  if (!env || env.alg !== ALG || !env.salt || !env.iv || !env.tag || !env.data) {
    throw new Error("file is not a valid Life Organizer backup");
  }
  const key = crypto.scryptSync(passphrase, Buffer.from(env.salt, "base64"), 32);
  const decipher = crypto.createDecipheriv(ALG, key, Buffer.from(env.iv, "base64"));
  decipher.setAuthTag(Buffer.from(env.tag, "base64"));
  let payload;
  try {
    const dec = Buffer.concat([decipher.update(Buffer.from(env.data, "base64")), decipher.final()]);
    payload = env.gz ? zlib.gunzipSync(dec) : dec;
  } catch {
    throw new Error("wrong passphrase or corrupted file");
  }
  let data;
  try {
    data = JSON.parse(payload.toString("utf8"));
  } catch {
    throw new Error("decrypted payload is corrupt");
  }
  if (!data || !Array.isArray(data.tables)) {
    throw new Error("decrypted payload is not a Life Organizer backup");
  }
  return data;
}
