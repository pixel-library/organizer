import { createApp } from "../server/app.js";
import { connectDatabase, disconnectDatabase, getPool } from "../server/db.js";

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

let base;

async function main() {
  await connectDatabase();
  const suffix = Date.now();
  const emailA = `profile-a-${suffix}@test.dev`;
  const emailB = `profile-b-${suffix}@test.dev`;
  const password = "correct-horse-battery-staple";

  await getPool().query("DELETE FROM users WHERE email LIKE $1", ["profile-%@test.dev"]);

  const app = createApp();
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const { port } = server.address();
  base = `http://127.0.0.1:${port}/api`;

  const call = (method, path, body, cookie) =>
    fetch(`${base}${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        ...(cookie ? { cookie } : {})
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {})
    });

  const register = async (name, email) => {
    const res = await call("POST", "/auth/register", { name, email, password });
    return { res, cookie: cookieFrom(res), body: await res.json() };
  };

  // Setup: User A and User B
  const userA = await register("Alice A", emailA);
  const userB = await register("Bob B", emailB);
  assert("register User A → 201", userA.res.status === 201, String(userA.res.status));
  assert("register User B → 201", userB.res.status === 201, String(userB.res.status));

  // 2. Read profile (User A)
  const readA = await call("GET", "/profile", undefined, userA.cookie);
  assert("GET /profile (A) → 200", readA.status === 200, String(readA.status));
  const profileA = await readA.json();
  assert("GET /profile (A) returns A name", profileA.name === "Alice A", profileA.name);
  assert("GET /profile (A) returns A email", profileA.email === emailA, profileA.email);
  assert("GET /profile (A) returns A id", String(profileA.id) === String(userA.body.id));
  assert("GET /profile never returns password_hash", profileA.password_hash === undefined && profileA.password === undefined);

  // 3. Update profile (User A)
  const updateA = await call("PUT", "/profile", { name: "Alice Updated", email: emailA }, userA.cookie);
  assert("PUT /profile (A) → 200", updateA.status === 200, String(updateA.status));
  const updatedA = await updateA.json();
  assert("PUT /profile (A) returns new name", updatedA.name === "Alice Updated", updatedA.name);
  assert("PUT /profile (A) preserves email", updatedA.email === emailA);

  // 4. Refresh — fresh request still sees updated profile
  const refreshA = await call("GET", "/profile", undefined, userA.cookie);
  assert("refresh → 200", refreshA.status === 200, String(refreshA.status));
  const refreshBody = await refreshA.json();
  assert("refresh shows persisted name", refreshBody.name === "Alice Updated", refreshBody.name);

  // 5. Verify persistence directly in the database
  const dbA = await getPool().query("SELECT name, email FROM users WHERE id = $1", [userA.body.id]);
  assert("persisted to database", dbA.rows[0].name === "Alice Updated" && dbA.rows[0].email === emailA);

  // 6. User B isolation — client-supplied userId/id must be ignored
  const updateB = await call(
    "PUT",
    "/profile",
    { name: "Bob Updated", userId: userA.body.id, id: userA.body.id, email: emailB },
    userB.cookie
  );
  assert("PUT /profile (B) → 200", updateB.status === 200, String(updateB.status));
  const updatedB = await updateB.json();
  assert("B update ignored client userId — changed B only", updatedB.name === "Bob Updated" && String(updatedB.id) === String(userB.body.id));

  const aAfter = await call("GET", "/profile", undefined, userA.cookie).then((r) => r.json());
  const bAfter = await call("GET", "/profile", undefined, userB.cookie).then((r) => r.json());
  assert("A profile unchanged by B", aAfter.name === "Alice Updated");
  assert("B profile has own update", bAfter.name === "Bob Updated");
  assert("A email untouched", aAfter.email === emailA);

  // B cannot claim A's email
  const stealEmail = await call("PUT", "/profile", { email: emailA }, userB.cookie);
  assert("B taking A email → 409", stealEmail.status === 409, String(stealEmail.status));

  // Validation
  const badName = await call("PUT", "/profile", { name: "" }, userA.cookie);
  assert("empty name → 400", badName.status === 400);
  const badEmail = await call("PUT", "/profile", { email: "nope" }, userA.cookie);
  assert("invalid email → 400", badEmail.status === 400);
  const noFields = await call("PUT", "/profile", {}, userA.cookie);
  assert("empty body → 400", noFields.status === 400);

  // Email-only update (partial)
  const partial = await call("PUT", "/profile", { name: "Alice Final" }, userA.cookie);
  assert("partial update keeps email", (await partial.json()).email === emailA);

  // Unauthenticated access
  const noCookieGet = await call("GET", "/profile", undefined);
  assert("GET /profile without login → 401", noCookieGet.status === 401, String(noCookieGet.status));
  const noCookiePut = await call("PUT", "/profile", { name: "X" });
  assert("PUT /profile without login → 401", noCookiePut.status === 401, String(noCookiePut.status));

  // Cleanup
  await getPool().query("DELETE FROM users WHERE email LIKE $1", ["profile-%@test.dev"]);
  const leftover = await getPool().query("SELECT count(*)::int AS n FROM sessions");
  assert("no leftover sessions after cleanup", leftover.rows[0].n === 0, `${leftover.rows[0].n} rows`);

  server.close();
  await disconnectDatabase();

  if (failures > 0) {
    console.log(`\n${failures} FAILURE(S)`);
    process.exit(1);
  }
  console.log("\nALL PROFILE TESTS PASSED");
}

main().catch(async (err) => {
  console.error("ERROR:", err.message);
  try {
    await disconnectDatabase();
  } catch {}
  process.exit(1);
});
