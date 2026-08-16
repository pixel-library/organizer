import { createApp } from "../server/app.js";
import { connectDatabase, disconnectDatabase, getPool } from "../server/db.js";
import { COOKIE_NAME } from "../server/utils/sessions.js";

let failures = 0;
const assert = (name, cond, extra = "") => {
  if (cond) {
    console.log(`PASS: ${name}`);
  } else {
    failures += 1;
    console.log(`FAIL: ${name}${extra ? ` — ${extra}` : ""}`);
  }
};

const cookieFrom = (res) => {
  const setCookie = res.headers.getSetCookie();
  if (setCookie.length === 0) return null;
  return setCookie[0].split(";")[0];
};

const FAKE_SUB = {
  endpoint: "https://fcm.googleapis.com/fcm/send/fake-endpoint-123456",
  keys: {
    p256dh: "BHHnD2QyZxQ4kP5gQqG8bGvP4x9tQ0mOq7XyWc3zNvX9k0YzL7c2QzB0x1y2z3a4b5c6d7e8f9g0h",
    auth: "a3JfX2Vhc3l0ZXN0a2V5MTIzNDU2Nzg5"
  }
};

let base;

async function main() {
  await connectDatabase();
  const suffix = Date.now();
  const username = `push-${suffix}`;
  const password = "correct-horse-battery-staple";

  await getPool().query("DELETE FROM users WHERE username LIKE $1", ["push-%"]);
  await getPool().query("DELETE FROM push_subscriptions WHERE endpoint LIKE $1", ["%fake-endpoint%"]);

  const app = createApp();
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const { port } = server.address();
  base = `http://127.0.0.1:${port}/api/push`;
  const authBase = `http://127.0.0.1:${port}/api/auth`;

  const post = (url, body, cookie) =>
    fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
      body: JSON.stringify(body)
    });

  const get = (url, cookie) => fetch(url, { headers: cookie ? { cookie } : {} });

  // 1. Register a user
  const reg = await post(`${authBase}/register`, { name: "Push Test", username, password });
  assert("register returns 201", reg.status === 201, String(reg.status));
  const cookie = cookieFrom(reg);
  assert("register sets session cookie", cookie?.startsWith(`${COOKIE_NAME}=`), cookie ?? "no cookie");

  // 2. Auth required
  const anon = await get(`${base}/vapid-public-key`);
  assert("vapid-public-key requires auth (401)", anon.status === 401, String(anon.status));

  const anonSub = await post(`${base}/subscribe`, FAKE_SUB);
  assert("subscribe requires auth (401)", anonSub.status === 401, String(anonSub.status));

  // 3. VAPID key endpoint: serves the configured public key
  const noKey = await get(`${base}/vapid-public-key`, cookie);
  const keyBody = noKey.status === 200 ? await noKey.json() : null;
  assert(
    "vapid-public-key returns configured key (200)",
    noKey.status === 200 && typeof keyBody?.key === "string" && keyBody.key.length > 40,
    String(noKey.status)
  );

  // 4. Subscribe validation
  const badEndpoint = await post(`${base}/subscribe`, { ...FAKE_SUB, endpoint: "not-a-url" }, cookie);
  assert("subscribe rejects bad endpoint (400)", badEndpoint.status === 400, String(badEndpoint.status));

  const badKeys = await post(`${base}/subscribe`, { ...FAKE_SUB, keys: {} }, cookie);
  assert("subscribe rejects missing keys (400)", badKeys.status === 400, String(badKeys.status));

  const missingSub = await post(`${base}/subscribe`, {}, cookie);
  assert("subscribe rejects missing subscription (400)", missingSub.status === 400, String(missingSub.status));

  // 5. Subscribe
  const ok = await post(`${base}/subscribe`, FAKE_SUB, cookie);
  assert("subscribe returns 201", ok.status === 201, String(ok.status));

  // 6. Idempotent re-subscribe (same endpoint)
  const again = await post(`${base}/subscribe`, { ...FAKE_SUB, tzOffsetMinutes: -330 }, cookie);
  assert("re-subscribe same endpoint is idempotent (201)", again.status === 201, String(again.status));

  // 7. Listed for this user
  const list = await get(`${base}/subscriptions`, cookie);
  assert("subscriptions lists the stored endpoint", list.status === 200 && (await list.json()).length === 1);

  // 8. Delete
  const del = await fetch(`${base}/subscribe?endpoint=${encodeURIComponent(FAKE_SUB.endpoint)}`, {
    method: "DELETE",
    headers: { cookie }
  });
  assert("unsubscribe returns 204", del.status === 204, String(del.status));

  const listAfter = await get(`${base}/subscriptions`, cookie);
  assert("subscriptions empty after delete", (await listAfter.json()).length === 0);

  // 9. Cleanup
  await getPool().query("DELETE FROM push_subscriptions WHERE endpoint LIKE $1", ["%fake-endpoint%"]);
  await getPool().query("DELETE FROM users WHERE username LIKE $1", ["push-%"]);

  server.close(async () => {
    await disconnectDatabase();
    process.exit(failures > 0 ? 1 : 0);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});