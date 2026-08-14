export const up = (pgm) => {
  pgm.createTable("sessions", {
    id: { type: "bigserial", primaryKey: true },
    token_hash: { type: "text", notNull: true, unique: true },
    user_id: {
      type: "bigint",
      notNull: true,
      references: "users",
      onDelete: "CASCADE"
    },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    last_seen_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    expires_at: { type: "timestamptz", notNull: true },
    revoked_at: { type: "timestamptz" }
  });
  pgm.createIndex("sessions", "user_id");
  pgm.createIndex("sessions", "expires_at");
};

export const down = (pgm) => {
  pgm.dropTable("sessions");
};
