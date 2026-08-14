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
  const [pair] = setCookie[0].split(";");
  return pair;
};

const hasHttpOnly = (res) => res.headers.getSetCookie().some((c) => /httpOnly/i.test(c));

const isCookieCleared = (res) => {
  const setCookie = res.headers.getSetCookie();
  if (setCookie.length === 0) return false;
  return /Max-Age=0/.test(setCookie[0]) || /expires=Thu, 01 Jan 1970/i.test(setCookie[0]);
};

const safeKeys = (obj) => Object.keys(obj).sort().join(",");

let base;

async function main() {
  await connectDatabase();
  const suffix = Date.now();
  const emailA = `auth-${suffix}@test.dev`;
  const password = "correct-horse-battery-staple";

  await getPool().query("DELETE FROM users WHERE email LIKE $1", ["auth-%@test.dev"]);

  const app = createApp();
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const { port } = server.address();
  base = `http://127.0.0.1:${port}/api/auth`;

  const post = (path, body, cookie) =>
    fetch(`${base}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(cookie ? { cookie } : {})
      },
      body: JSON.stringify(body)
    });

  const get = (path, cookie) =>
    fetch(`${base}${path}`, { headers: cookie ? { cookie } : {} });

  // 1. Register
  const reg = await post("/register", {
    name: "Auth Test",
    email: emailA,
    password
  });
  assert("register returns 201", reg.status === 201, String(reg.status));
  const regUser = await reg.json();
  assert("register sets session cookie", cookieFrom(reg)?.startsWith(`${COOKIE_NAME}=`), cookieFrom(reg) ?? "no cookie");
  assert("register cookie is httpOnly", hasHttpOnly(reg));
  assert("register returns user id", Number.isInteger(Number(regUser.id)));
  assert("register returns name", regUser.name === "Auth Test");
  assert("register returns email (lowercased)", regUser.email === emailA);
  assert("register never returns password/password_hash/secrets", !/password/.test(safeKeys(regUser)) && !regUser.passwordHash);

  const regCookie = cookieFrom(reg);

  // Duplicate email protection (case-insensitive)
  const dup = await post("/register", { name: "Other", email: emailA.toUpperCase(), password });
  assert("duplicate email → 409", dup.status === 409);

  // Validation
  const badEmail = await post("/register", { name: "X", email: "not-an-email", password });
  assert("invalid email → 400", badEmail.status === 400);
  const shortPass = await post("/register", { name: "X", email: `x-${suffix}@test.dev`, password: "short" });
  assert("short password → 400", shortPass.status === 400);
  const emptyName = await post("/register", { name: "  ", email: `y-${suffix}@test.dev`, password });
  assert("empty name → 400", emptyName.status === 400);
  const noBody = await post("/register", {}, regCookie);
  assert("empty payload → 400", noBody.status === 400);

  // 2. Login
  const badLogin = await post("/login", { email: emailA, password: "wrong-password" });
  assert("login wrong password → 401", badLogin.status === 401);
  const unknownLogin = await post("/login", { email: `nobody-${suffix}@test.dev`, password });
  assert("login unknown email → 401", unknownLogin.status === 401);

  const login = await post("/login", { email: emailA, password });
  assert("login returns 200", login.status === 200, String(login.status));
  assert("login sets session cookie", cookieFrom(login)?.startsWith(`${COOKIE_NAME}=`), cookieFrom(login) ?? "no cookie");
  const loginUser = await login.json();
  assert("login returns safe user", loginUser.email === emailA && !loginUser.password_hash);

  const loginCookie = cookieFrom(login);

  // 3. /me
  const me = await get("/me", loginCookie);
  assert("me returns 200", me.status === 200, String(me.status));
  const meUser = await me.json();
  assert("me returns authenticated user id", String(meUser.id) === String(loginUser.id));
  assert("me returns safe user info only", safeKeys(meUser) === "createdAt,email,id,name,updatedAt", safeKeys(meUser));
  assert("me never returns password_hash", meUser.password_hash === undefined && meUser.password === undefined);

  // 4. Refresh session (sliding renewal)
  await getPool().query(
    "UPDATE sessions SET last_seen_at = now() - interval '20 minutes' WHERE token_hash = (SELECT token_hash FROM sessions ORDER BY id DESC LIMIT 1)"
  );
  const before = await getPool().query(
    "SELECT expires_at FROM sessions WHERE token_hash = (SELECT token_hash FROM sessions ORDER BY id DESC LIMIT 1)"
  );
  const refreshed = await get("/me", loginCookie);
  const after = await getPool().query(
    "SELECT expires_at FROM sessions WHERE token_hash = (SELECT token_hash FROM sessions ORDER BY id DESC LIMIT 1)"
  );
  assert("refreshed session still valid (200)", refreshed.status === 200, String(refreshed.status));
  assert(
    "session expiry extended on activity",
    new Date(after.rows[0].expires_at).getTime() > new Date(before.rows[0].expires_at).getTime()
  );

  // 5. Logout
  const logout = await post("/logout", {}, loginCookie);
  assert("logout returns 204", logout.status === 204, String(logout.status));
  assert("logout clears cookie", isCookieCleared(logout));
  const meAfterLogout = await get("/me", loginCookie);
  assert("me after logout → 401", meAfterLogout.status === 401, String(meAfterLogout.status));

  // Register cookie still valid (separate session)
  const meWithRegCookie = await get("/me", regCookie);
  assert("register-created session works via /me", meWithRegCookie.status === 200);

  // 6. Protected endpoint without login
  const noCookie = await get("/me");
  assert("protected endpoint without login → 401", noCookie.status === 401, String(noCookie.status));

  const garbageCookie = await get("/me", "life_organizer_sid=not-a-real-token");
  assert("protected endpoint with garbage cookie → 401", garbageCookie.status === 401, String(garbageCookie.status));

  // Cleanup
  await getPool().query("DELETE FROM users WHERE email LIKE $1", ["auth-%@test.dev"]);
  const leftover = await getPool().query("SELECT count(*)::int AS n FROM sessions");
  assert("no leftover sessions after cleanup", leftover.rows[0].n === 0, `${leftover.rows[0].n} rows`);

  server.close();
  await disconnectDatabase();

  if (failures > 0) {
    console.log(`\n${failures} FAILURE(S)`);
    process.exit(1);
  }
  console.log("\nALL AUTH TESTS PASSED");
}

main().catch(async (err) => {
  console.error("ERROR:", err.message);
  try {
    await disconnectDatabase();
  } catch {}
  process.exit(1);
});
