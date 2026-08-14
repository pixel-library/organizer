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
  const emailA = `cal-a-${suffix}@test.dev`;
  const emailB = `cal-b-${suffix}@test.dev`;
  const password = "correct-horse-battery-staple";

  await getPool().query("DELETE FROM users WHERE email LIKE $1", ["cal-%@test.dev"]);

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

  const userA = await register("Cal Alice", emailA);
  const userB = await register("Cal Bob", emailB);
  assert("register User A → 201", userA.res.status === 201);
  assert("register User B → 201", userB.res.status === 201);

  // Create event
  const eventPayload = {
    title: "Team standup",
    start: "2026-08-18",
    end: "2026-08-18",
    startTime: "09:00",
    endTime: "09:30",
    allDay: false,
    category: "Work",
    location: "Room 4",
    description: "Daily sync",
    reminder: "10m",
    recurrence: "custom",
    recurrenceEnd: "2026-12-31",
    customWeekdays: [1, 3, 5],
    overrides: { "2026-08-25": { deleted: true } },
    userId: userB.body.id
  };
  const created = await call("POST", "/calendarEvents", eventPayload, userA.cookie);
  assert("POST /calendarEvents → 201", created.status === 201, String(created.status));
  const event = await created.json();
  assert("event has id", event.id !== undefined && event.id !== null);
  assert("event round-trips title", event.title === "Team standup");
  assert("event round-trips start", event.start === "2026-08-18");
  assert("event round-trips end", event.end === "2026-08-18");
  assert("event round-trips startTime", event.startTime === "09:00", event.startTime);
  assert("event round-trips endTime", event.endTime === "09:30");
  assert("event round-trips allDay", event.allDay === false);
  assert("event round-trips category", event.category === "Work");
  assert("event round-trips location", event.location === "Room 4");
  assert("event round-trips recurrence", event.recurrence === "custom");
  assert("event round-trips recurrenceEnd", event.recurrenceEnd === "2026-12-31");
  assert("event round-trips customWeekdays", JSON.stringify(event.customWeekdays) === "[1,3,5]");
  assert("event round-trips overrides", event.overrides["2026-08-25"].deleted === true);
  assert("event response has no secrets", event.password_hash === undefined && event.user_id === undefined);

  const dbCheck = await getPool().query("SELECT user_id FROM calendar_events WHERE id = $1", [event.id]);
  assert("ownership set from session (not client)", String(dbCheck.rows[0].user_id) === String(userA.body.id));

  // Refresh + persistence
  const list = await call("GET", "/calendarEvents", undefined, userA.cookie);
  assert("GET /calendarEvents → 200", list.status === 200);
  const listBody = await list.json();
  assert("GET /calendarEvents returns array", Array.isArray(listBody));
  assert("event remains after refresh", listBody.some((e) => String(e.id) === String(event.id)));

  const dbEvent = await getPool().query(
    "SELECT title, start_date, all_day, custom_weekdays FROM calendar_events WHERE id = $1",
    [event.id]
  );
  const storedDate = dbEvent.rows[0].start_date;
  const storedKey = `${storedDate.getFullYear()}-${String(storedDate.getMonth() + 1).padStart(2, "0")}-${String(storedDate.getDate()).padStart(2, "0")}`;
  assert("persisted to database", dbEvent.rows[0].title === "Team standup" && storedKey === "2026-08-18", storedKey);

  // Date range query
  const inRange = await call("GET", "/calendarEvents?from=2026-08-01&to=2026-08-31", undefined, userA.cookie);
  assert("date range includes event", (await inRange.json()).some((e) => String(e.id) === String(event.id)));
  const outRange = await call("GET", "/calendarEvents?from=2027-01-01", undefined, userA.cookie);
  assert("date range excludes event", (await outRange.json()).length === 0);

  // Edit
  const edited = await call("PATCH", `/calendarEvents/${event.id}`, { title: "Sprint standup", start: "2026-08-19", startTime: "10:00" }, userA.cookie);
  assert("PATCH /calendarEvents/:id → 200", edited.status === 200, String(edited.status));
  const editedBody = await edited.json();
  assert("PATCH updates title", editedBody.title === "Sprint standup");
  assert("PATCH updates start", editedBody.start === "2026-08-19");
  assert("PATCH updates startTime", editedBody.startTime === "10:00");
  assert("PATCH preserves overrides", editedBody.overrides["2026-08-25"]?.deleted === true);
  assert("PATCH preserves category", editedBody.category === "Work");

  // PUT also works
  const put = await call("PUT", `/calendarEvents/${event.id}`, { allDay: true }, userA.cookie);
  assert("PUT /calendarEvents/:id → 200", put.status === 200, String(put.status));
  assert("PUT updates allDay", (await put.json()).allDay === true);
  await call("PATCH", `/calendarEvents/${event.id}`, { allDay: false }, userA.cookie);

  // Logout/login persistence
  await call("POST", "/auth/logout", {}, userA.cookie);
  const relogin = await call("POST", "/auth/login", { email: emailA, password }, undefined);
  assert("relogin → 200", relogin.status === 200);
  const cookie2 = cookieFrom(relogin);
  const afterLogin = await call("GET", "/calendarEvents", undefined, cookie2);
  assert("events persist across logout/login", (await afterLogin.json()).some((e) => String(e.id) === String(event.id)));

  // Validation
  const noTitle = await call("POST", "/calendarEvents", { start: "2026-08-20" }, cookie2);
  assert("POST without title → 400", noTitle.status === 400, String(noTitle.status));
  const noStart = await call("POST", "/calendarEvents", { title: "X" }, cookie2);
  assert("POST without start → 400", noStart.status === 400, String(noStart.status));
  const badDate = await call("POST", "/calendarEvents", { title: "X", start: "garbage" }, cookie2);
  assert("invalid start date → 400", badDate.status === 400);
  const badWeekdays = await call("POST", "/calendarEvents", { title: "X", start: "2026-08-20", customWeekdays: [1, 9] }, cookie2);
  assert("customWeekdays out of range → 400", badWeekdays.status === 400);
  const badOverrides = await call("POST", "/calendarEvents", { title: "X", start: "2026-08-20", overrides: [1] }, cookie2);
  assert("overrides must be object → 400", badOverrides.status === 400);
  const emptyPatch = await call("PATCH", `/calendarEvents/${event.id}`, {}, cookie2);
  assert("empty PATCH body → 400", emptyPatch.status === 400);
  const noAuth = await call("GET", "/calendarEvents", undefined, undefined);
  assert("GET /calendarEvents without login → 401", noAuth.status === 401);

  // Isolation — User B must not read/edit/delete A's event
  const bRead = await call("GET", `/calendarEvents/${event.id}`, undefined, userB.cookie);
  assert("B cannot read A event → 404", bRead.status === 404, String(bRead.status));
  const bEdit = await call("PATCH", `/calendarEvents/${event.id}`, { title: "hacked" }, userB.cookie);
  assert("B cannot edit A event → 404", bEdit.status === 404, String(bEdit.status));
  const bDelete = await call("DELETE", `/calendarEvents/${event.id}`, undefined, userB.cookie);
  assert("B cannot delete A event → 404", bDelete.status === 404, String(bDelete.status));
  const bList = await call("GET", "/calendarEvents", undefined, userB.cookie);
  assert("B list excludes A event", (await bList.json()).length === 0);

  // B creates own event — isolation of data
  const bEvent = await call("POST", "/calendarEvents", { title: "B's event", start: "2026-08-21" }, userB.cookie);
  assert("B creates own event → 201", bEvent.status === 201);
  const bEventBody = await bEvent.json();
  const aList = await call("GET", "/calendarEvents", undefined, cookie2);
  assert("A list excludes B event", !(await aList.json()).some((e) => String(e.id) === String(bEventBody.id)));

  const stillThere = await call("GET", `/calendarEvents/${event.id}`, undefined, cookie2);
  assert("A event intact after B attempts", stillThere.status === 200);

  // Delete
  const del = await call("DELETE", `/calendarEvents/${event.id}`, undefined, cookie2);
  assert("DELETE /calendarEvents/:id → 204", del.status === 204, String(del.status));
  const gone = await call("GET", `/calendarEvents/${event.id}`, undefined, cookie2);
  assert("event gone after delete → 404", gone.status === 404, String(gone.status));

  // Cleanup
  await getPool().query("DELETE FROM users WHERE email LIKE $1", ["cal-%@test.dev"]);
  const leftoverEvents = await getPool().query("SELECT count(*)::int AS n FROM calendar_events");
  assert("no leftover test events", leftoverEvents.rows[0].n === 0, `${leftoverEvents.rows[0].n} rows`);

  server.close();
  await disconnectDatabase();

  if (failures > 0) {
    console.log(`\n${failures} FAILURE(S)`);
    process.exit(1);
  }
  console.log("\nALL CALENDAR TESTS PASSED");
}

main().catch(async (err) => {
  console.error("ERROR:", err.message);
  try {
    await disconnectDatabase();
  } catch {}
  process.exit(1);
});
