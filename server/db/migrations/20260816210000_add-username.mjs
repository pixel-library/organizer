/**
 * Replace email as the login identity with a unique username.
 * Existing users get a username derived from their email local-part;
 * the email column is retained (nullable, unused by the app) so no data
 * is destroyed. New accounts are created with username + name only —
 * no email is collected anymore.
 */
export const up = (pgm) => {
  pgm.addColumn("users", {
    username: { type: "text" }
  });

  pgm.alterColumn("users", "email", { notNull: false });

  pgm.sql(`
    WITH backfilled AS (
      SELECT id,
             lower(regexp_replace(left(split_part(email, '@', 1), 30), '[^a-z0-9_-]', '', 'g')) AS base
      FROM users
    ),
    filled AS (
      SELECT id,
             CASE
               WHEN base ~ '^[a-z0-9]' THEN base
               ELSE 'user' || base
             END AS base
      FROM backfilled
    ),
    numbered AS (
      SELECT id, base,
             row_number() OVER (PARTITION BY base ORDER BY id) AS n
      FROM filled
    )
    UPDATE users u
    SET username = CASE
      WHEN n.n = 1 THEN n.base
      ELSE substr(n.base, 1, 27) || '-' || n.n
    END
    FROM numbered n
    WHERE u.id = n.id
  `);

  pgm.alterColumn("users", "username", { type: "text", notNull: true });

  pgm.createIndex("users", "username", { unique: true, name: "users_username_unique" });
  pgm.sql("CREATE UNIQUE INDEX users_username_lower_unique ON users (lower(username))");
};

export const down = (pgm) => {
  pgm.sql("DROP INDEX IF EXISTS users_username_lower_unique");
  pgm.dropIndex("users", "username", { name: "users_username_unique" });
  pgm.alterColumn("users", "email", { notNull: true });
  pgm.dropColumn("users", "username");
};