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
  const emailA = `notes-a-${suffix}@test.dev`;
  const emailB = `notes-b-${suffix}@test.dev`;
  const password = "correct-horse-battery-staple";

  await getPool().query("DELETE FROM users WHERE email LIKE $1", ["notes-%@test.dev"]);

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

  const userA = await register("Note Alice", emailA);
  const userB = await register("Note Bob", emailB);
  assert("register User A → 201", userA.res.status === 201);
  assert("register User B → 201", userB.res.status === 201);

  // Create note
  const notePayload = {
    title: "Meeting notes",
    content: "Discuss the quarterly roadmap with the team.",
    category: "Work",
    pinned: true,
    archived: false,
    tags: ["meeting", "roadmap"],
    userId: userB.body.id
  };
  const created = await call("POST", "/notes", notePayload, userA.cookie);
  assert("POST /notes → 201", created.status === 201, String(created.status));
  const note = await created.json();
  assert("note has id", note.id !== undefined && note.id !== null);
  assert("note round-trips title", note.title === "Meeting notes");
  assert("note round-trips content", note.content.includes("quarterly roadmap"));
  assert("note round-trips category", note.category === "Work");
  assert("note round-trips pinned", note.pinned === true);
  assert("note round-trips archived", note.archived === false);
  assert("note round-trips tags", Array.isArray(note.tags) && note.tags.includes("roadmap"));
  assert("note response has no secrets", note.password_hash === undefined && note.user_id === undefined);

  const dbCheck = await getPool().query("SELECT user_id FROM notes WHERE id = $1", [note.id]);
  assert("ownership set from session (not client)", String(dbCheck.rows[0].user_id) === String(userA.body.id));

  // Refresh + persistence
  const list = await call("GET", "/notes", undefined, userA.cookie);
  assert("GET /notes → 200", list.status === 200);
  const listBody = await list.json();
  assert("GET /notes returns array", Array.isArray(listBody));
  assert("GET /notes contains created note", listBody.some((n) => String(n.id) === String(note.id)));

  const dbNote = await getPool().query("SELECT title, content, category, pinned, archived FROM notes WHERE id = $1", [note.id]);
  assert("persisted to database", dbNote.rows[0].title === "Meeting notes" && dbNote.rows[0].pinned === true);

  // Read single
  const single = await call("GET", `/notes/${note.id}`, undefined, userA.cookie);
  assert("GET /notes/:id → 200", single.status === 200, String(single.status));
  assert("GET /notes/:id matches", (await single.json()).title === "Meeting notes");

  // Edit
  const edited = await call("PATCH", `/notes/${note.id}`, { title: "Q3 roadmap notes", content: "Updated content", category: "Important" }, userA.cookie);
  assert("PATCH /notes/:id → 200", edited.status === 200, String(edited.status));
  const editedBody = await edited.json();
  assert("PATCH updates title", editedBody.title === "Q3 roadmap notes");
  assert("PATCH updates category", editedBody.category === "Important");
  assert("PATCH preserves pinned", editedBody.pinned === true);
  assert("PATCH preserves tags", editedBody.tags.includes("meeting"));

  // PUT also works
  const put = await call("PUT", `/notes/${note.id}`, { archived: true }, userA.cookie);
  assert("PUT /notes/:id → 200", put.status === 200, String(put.status));
  assert("PUT updates archived", (await put.json()).archived === true);

  // Un-archive for later tests
  await call("PATCH", `/notes/${note.id}`, { archived: false }, userA.cookie);

  // Search / filters / sort
  const search = await call("GET", "/notes?search=roadmap", undefined, userA.cookie);
  assert("search matches title", (await search.json()).some((n) => String(n.id) === String(note.id)));
  const searchContent = await call("GET", "/notes?search=Updated%20content", undefined, userA.cookie);
  assert("search matches content", (await searchContent.json()).some((n) => String(n.id) === String(note.id)));
  const searchTag = await call("GET", "/notes?search=meeting", undefined, userA.cookie);
  assert("search matches tags", (await searchTag.json()).some((n) => String(n.id) === String(note.id)));
  const searchNo = await call("GET", "/notes?search=zzzznomatch", undefined, userA.cookie);
  assert("search no-match → empty", (await searchNo.json()).length === 0);
  const byCategory = await call("GET", "/notes?category=Important", undefined, userA.cookie);
  assert("filter category", (await byCategory.json()).some((n) => String(n.id) === String(note.id)));
  const archived = await call("GET", "/notes?archived=true", undefined, userA.cookie);
  assert("filter archived=true → empty", (await archived.json()).length === 0);
  const sortAz = await call("GET", "/notes?sort=az", undefined, userA.cookie);
  assert("sort=az works", Array.isArray(await sortAz.json()));

  // Logout/login persistence
  await call("POST", "/auth/logout", {}, userA.cookie);
  const relogin = await call("POST", "/auth/login", { email: emailA, password }, undefined);
  assert("relogin → 200", relogin.status === 200);
  const cookie2 = cookieFrom(relogin);
  const afterLogin = await call("GET", "/notes", undefined, cookie2);
  assert("notes persist across logout/login", (await afterLogin.json()).some((n) => String(n.id) === String(note.id)));

  // Validation
  const badTags = await call("POST", "/notes", { title: "X", tags: [1, 2] }, cookie2);
  assert("non-string tags → 400", badTags.status === 400, String(badTags.status));
  const emptyPatch = await call("PATCH", `/notes/${note.id}`, {}, cookie2);
  assert("empty PATCH body → 400", emptyPatch.status === 400);
  const noAuth = await call("GET", "/notes", undefined, undefined);
  assert("GET /notes without login → 401", noAuth.status === 401);

  // Isolation — User B must not read/edit/delete A's note
  const bRead = await call("GET", `/notes/${note.id}`, undefined, userB.cookie);
  assert("B cannot read A note → 404", bRead.status === 404, String(bRead.status));
  const bEdit = await call("PATCH", `/notes/${note.id}`, { title: "hacked" }, userB.cookie);
  assert("B cannot edit A note → 404", bEdit.status === 404, String(bEdit.status));
  const bDelete = await call("DELETE", `/notes/${note.id}`, undefined, userB.cookie);
  assert("B cannot delete A note → 404", bDelete.status === 404, String(bDelete.status));
  const bList = await call("GET", "/notes", undefined, userB.cookie);
  assert("B list excludes A note", (await bList.json()).length === 0);

  const stillThere = await call("GET", `/notes/${note.id}`, undefined, cookie2);
  assert("A note intact after B attempts", stillThere.status === 200);

  // Delete
  const del = await call("DELETE", `/notes/${note.id}`, undefined, cookie2);
  assert("DELETE /notes/:id → 204", del.status === 204, String(del.status));
  const gone = await call("GET", `/notes/${note.id}`, undefined, cookie2);
  assert("note gone after delete → 404", gone.status === 404, String(gone.status));

  // Cleanup
  await getPool().query("DELETE FROM users WHERE email LIKE $1", ["notes-%@test.dev"]);
  const leftoverNotes = await getPool().query("SELECT count(*)::int AS n FROM notes");
  assert("no leftover test notes", leftoverNotes.rows[0].n === 0, `${leftoverNotes.rows[0].n} rows`);

  server.close();
  await disconnectDatabase();

  if (failures > 0) {
    console.log(`\n${failures} FAILURE(S)`);
    process.exit(1);
  }
  console.log("\nALL NOTES TESTS PASSED");
}

main().catch(async (err) => {
  console.error("ERROR:", err.message);
  try {
    await disconnectDatabase();
  } catch {}
  process.exit(1);
});
