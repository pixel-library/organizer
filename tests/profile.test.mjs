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
  const usernameA = `profile-a-${suffix}`;
  const usernameB = `profile-b-${suffix}`;
  const password = "correct-horse-battery-staple";

  await getPool().query("DELETE FROM users WHERE username LIKE $1", ["profile-%"]);

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

  const register = async (name, username) => {
    const res = await call("POST", "/auth/register", { name, username, password });
    return { res, cookie: cookieFrom(res), body: await res.json() };
  };

  // Setup: User A and User B
  const userA = await register("Alice A", usernameA);
  const userB = await register("Bob B", usernameB);
  assert("register User A → 201", userA.res.status === 201, String(userA.res.status));
  assert("register User B → 201", userB.res.status === 201, String(userB.res.status));

  // 2. Read profile (User A)
  const readA = await call("GET", "/profile", undefined, userA.cookie);
  assert("GET /profile (A) → 200", readA.status === 200, String(readA.status));
  const profileA = await readA.json();
  assert("GET /profile (A) returns A name", profileA.name === "Alice A", profileA.name);
  assert("GET /profile (A) returns A username", profileA.username === usernameA, profileA.username);
  assert("GET /profile (A) returns A id", String(profileA.id) === String(userA.body.id));
  assert("GET /profile never returns password_hash", profileA.password_hash === undefined && profileA.password === undefined);

  // 3. Update profile (User A)
  const updateA = await call("PUT", "/profile", { name: "Alice Updated", username: usernameA }, userA.cookie);
  assert("PUT /profile (A) → 200", updateA.status === 200, String(updateA.status));
  const updatedA = await updateA.json();
  assert("PUT /profile (A) returns new name", updatedA.name === "Alice Updated", updatedA.name);
  assert("PUT /profile (A) preserves username", updatedA.username === usernameA);

  // 4. Refresh — fresh request still sees updated profile
  const refreshA = await call("GET", "/profile", undefined, userA.cookie);
  assert("refresh → 200", refreshA.status === 200, String(refreshA.status));
  const refreshBody = await refreshA.json();
  assert("refresh shows persisted name", refreshBody.name === "Alice Updated", refreshBody.name);

  // 5. Verify persistence directly in the database
  const dbA = await getPool().query("SELECT name, username FROM users WHERE id = $1", [userA.body.id]);
  assert("persisted to database", dbA.rows[0].name === "Alice Updated" && dbA.rows[0].username === usernameA);

  // 6. User B isolation — client-supplied userId/id must be ignored
  const updateB = await call(
    "PUT",
    "/profile",
    { name: "Bob Updated", userId: userA.body.id, id: userA.body.id, username: usernameB },
    userB.cookie
  );
  assert("PUT /profile (B) → 200", updateB.status === 200, String(updateB.status));
  const updatedB = await updateB.json();
  assert("B update ignored client userId — changed B only", updatedB.name === "Bob Updated" && String(updatedB.id) === String(userB.body.id));

  const aAfter = await call("GET", "/profile", undefined, userA.cookie).then((r) => r.json());
  const bAfter = await call("GET", "/profile", undefined, userB.cookie).then((r) => r.json());
  assert("A profile unchanged by B", aAfter.name === "Alice Updated");
  assert("B profile has own update", bAfter.name === "Bob Updated");
  assert("A username untouched", aAfter.username === usernameA);

  // B cannot claim A's username
  const stealUsername = await call("PUT", "/profile", { username: usernameA }, userB.cookie);
  assert("B taking A username → 409", stealUsername.status === 409, String(stealUsername.status));

  // Validation
  const badName = await call("PUT", "/profile", { name: "" }, userA.cookie);
  assert("empty name → 400", badName.status === 400);
  const badUsername = await call("PUT", "/profile", { username: "no way!" }, userA.cookie);
  assert("invalid username → 400", badUsername.status === 400);
  const noFields = await call("PUT", "/profile", {}, userA.cookie);
  assert("empty body → 400", noFields.status === 400);

  // Name-only update (partial)
  const partial = await call("PUT", "/profile", { name: "Alice Final" }, userA.cookie);
  assert("partial update keeps username", (await partial.json()).username === usernameA);

  // Unauthenticated access
  const noCookieGet = await call("GET", "/profile", undefined);
  assert("GET /profile without login → 401", noCookieGet.status === 401, String(noCookieGet.status));
  const noCookiePut = await call("PUT", "/profile", { name: "X" });
  assert("PUT /profile without login → 401", noCookiePut.status === 401, String(noCookiePut.status));

  // Cleanup
  await getPool().query("DELETE FROM users WHERE username LIKE $1", ["profile-%"]);
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
