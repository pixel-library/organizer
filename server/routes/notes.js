import { Router } from "express";
import { AppError } from "../utils/AppError.js";
import { requireAuth } from "../middleware/auth.js";
import { getPool } from "../db.js";

const router = Router();

const FIELDS = [
  ["title", "title", "text"],
  ["content", "content", "text"],
  ["category", "category", "text"],
  ["pinned", "pinned", "bool"],
  ["archived", "archived", "bool"],
  ["tags", "tags", "array"]
];

const iso = (d) => (d instanceof Date ? d.toISOString() : d);

const serialize = (row) => ({
  id: row.id,
  title: row.title,
  content: row.content,
  category: row.category,
  pinned: row.pinned,
  archived: row.archived,
  tags: row.tags ?? [],
  createdAt: iso(row.created_at),
  updatedAt: iso(row.updated_at)
});

const normalizeText = (value) => (typeof value === "string" ? value : String(value ?? ""));

const normalizeField = (api, value) => {
  switch (api) {
    case "title":
    case "content":
    case "category":
      return normalizeText(value);
    case "pinned":
    case "archived":
      return Boolean(value);
    case "tags": {
      if (!Array.isArray(value)) throw new AppError("tags must be an array", 400);
      if (!value.every((t) => typeof t === "string")) throw new AppError("tags must contain only strings", 400);
      return value;
    }
    default:
      throw new AppError("Unexpected field", 400);
  }
};

const bindValue = (type, value) => value;

router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try {
    const conditions = ["user_id = $1"];
    const params = [req.user.id];
    const { search, category, archived, sort } = req.query;

    if (search) {
      params.push(`%${String(search).replace(/[\\%_]/g, (m) => `\\${m}`)}%`);
      conditions.push(
        `(title ILIKE $${params.length} OR content ILIKE $${params.length} OR array_to_string(tags, ' ') ILIKE $${params.length})`
      );
    }
    if (category && category !== "all") {
      params.push(category);
      conditions.push(`category = $${params.length}`);
    }
    if (archived === "true") conditions.push("archived = true");
    else if (archived === "false") conditions.push("archived = false");
    else if (archived !== undefined) throw new AppError("archived must be true or false", 400);

    const SORT = {
      updated: "updated_at DESC, id DESC",
      created: "created_at DESC, id DESC",
      oldest: "created_at ASC, id ASC",
      az: "lower(title) ASC NULLS LAST, id ASC",
      za: "lower(title) DESC NULLS LAST, id ASC"
    };
    const orderBy = SORT[sort] ?? SORT.updated;

    const { rows } = await getPool().query(
      `SELECT * FROM notes WHERE ${conditions.join(" AND ")} ORDER BY pinned DESC, ${orderBy}`,
      params
    );
    res.json(rows.map(serialize));
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const body = req.body ?? {};
    const columns = [];
    const values = [];
    for (const [api, db, type] of FIELDS) {
      if (body[api] === undefined) continue;
      values.push(bindValue(type, normalizeField(api, body[api])));
      columns.push(`"${db}"`);
    }
    const placeholders = values.map((_, i) => `$${i + 2}`);

    const { rows } = await getPool().query(
      `INSERT INTO notes (user_id${columns.length ? ", " + columns.join(", ") : ""})
       VALUES ($1${placeholders.length ? ", " + placeholders.join(", ") : ""})
       RETURNING *`,
      [req.user.id, ...values]
    );
    res.status(201).json(serialize(rows[0]));
  } catch (err) {
    next(err);
  }
});

const fetchOwned = async (id, userId) => {
  const { rows } = await getPool().query(
    "SELECT * FROM notes WHERE id = $1 AND user_id = $2",
    [id, userId]
  );
  if (rows.length === 0) throw new AppError("Note not found", 404);
  return rows[0];
};

router.get("/:id", async (req, res, next) => {
  try {
    const row = await fetchOwned(req.params.id, req.user.id);
    res.json(serialize(row));
  } catch (err) {
    next(err);
  }
});

router.put("/:id", updateNote);
router.patch("/:id", updateNote);

async function updateNote(req, res, next) {
  try {
    const body = req.body ?? {};
    const entries = [];
    for (const [api, db, type] of FIELDS) {
      if (body[api] === undefined) continue;
      entries.push([db, type, normalizeField(api, body[api])]);
    }
    if (entries.length === 0) throw new AppError("No valid fields provided", 400);

    const setClauses = entries.map(([db, _value], i) => `"${db}" = $${i + 3}`);
    const values = entries.map(([, type, value]) => bindValue(type, value));
    setClauses.push("updated_at = now()");

    const { rows } = await getPool().query(
      `UPDATE notes SET ${setClauses.join(", ")} WHERE id = $1 AND user_id = $2 RETURNING *`,
      [req.params.id, req.user.id, ...values]
    );
    if (rows.length === 0) throw new AppError("Note not found", 404);
    res.json(serialize(rows[0]));
  } catch (err) {
    next(err);
  }
}

router.delete("/:id", async (req, res, next) => {
  try {
    const { rowCount } = await getPool().query(
      "DELETE FROM notes WHERE id = $1 AND user_id = $2",
      [req.params.id, req.user.id]
    );
    if (rowCount === 0) throw new AppError("Note not found", 404);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
