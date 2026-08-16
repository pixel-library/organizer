const userRef = { type: "bigint", notNull: true, references: "users", onDelete: "CASCADE" };
const timestamp = (pgm) => ({ type: "timestamptz", notNull: true, default: pgm.func("now()") });

export const up = (pgm) => {
  pgm.createTable("push_subscriptions", {
    id: { type: "bigserial", primaryKey: true },
    user_id: userRef,
    endpoint: { type: "text", notNull: true },
    p256dh: { type: "text", notNull: true },
    auth: { type: "text", notNull: true },
    tz_offset_minutes: { type: "integer", notNull: true, default: 0 },
    user_agent: { type: "text", notNull: true, default: "" },
    created_at: timestamp(pgm),
    updated_at: timestamp(pgm)
  });
  pgm.addConstraint("push_subscriptions", "push_subscriptions_endpoint_unique", {
    unique: "endpoint"
  });
  pgm.createIndex("push_subscriptions", "user_id");
};

export const down = (pgm) => {
  pgm.dropTable("push_subscriptions");
};