const userRef = { type: "bigint", notNull: true, references: "users", onDelete: "CASCADE" };

export const up = (pgm) => {
  const timestamp = () => ({ type: "timestamptz", notNull: true, default: pgm.func("now()") });

  pgm.createTable("users", {
    id: { type: "bigserial", primaryKey: true },
    name: { type: "text", notNull: true },
    email: { type: "text", notNull: true },
    password_hash: { type: "text", notNull: true },
    created_at: timestamp(),
    updated_at: timestamp()
  });
  pgm.addConstraint("users", "users_email_unique", { unique: "email" });
  pgm.sql('CREATE UNIQUE INDEX "users_email_lower_unique" ON "users" (lower("email"))');

  pgm.createTable("tasks", {
    id: { type: "bigserial", primaryKey: true },
    user_id: userRef,
    name: { type: "text", notNull: true },
    date: { type: "date" },
    time: { type: "time" },
    priority: { type: "text", notNull: true, default: "Yellow" },
    reminder: { type: "text", notNull: true, default: "none" },
    completed: { type: "boolean", notNull: true, default: false },
    type: { type: "text", notNull: true, default: "Task" },
    description: { type: "text", notNull: true, default: "" },
    start_date: { type: "date" },
    estimated_time: { type: "text" },
    tags: { type: "text[]", notNull: true, default: "{}" },
    subtasks: { type: "jsonb", notNull: true, default: "[]" },
    recurring: { type: "text", notNull: true, default: "none" },
    created_at: timestamp(),
    updated_at: timestamp()
  });
  pgm.addConstraint("tasks", "tasks_priority_check", {
    check: "priority IN ('Red', 'Yellow', 'Green')"
  });
  pgm.createIndex("tasks", "user_id");
  pgm.createIndex("tasks", ["user_id", "date"]);
  pgm.createIndex("tasks", ["user_id", "completed"]);

  pgm.createTable("notes", {
    id: { type: "bigserial", primaryKey: true },
    user_id: userRef,
    title: { type: "text", notNull: true, default: "" },
    content: { type: "text", notNull: true, default: "" },
    category: { type: "text", notNull: true, default: "Personal" },
    pinned: { type: "boolean", notNull: true, default: false },
    archived: { type: "boolean", notNull: true, default: false },
    tags: { type: "text[]", notNull: true, default: "{}" },
    created_at: timestamp(),
    updated_at: timestamp()
  });
  pgm.createIndex("notes", "user_id");
  pgm.createIndex("notes", ["user_id", "archived"]);

  pgm.createTable("calendar_events", {
    id: { type: "bigserial", primaryKey: true },
    user_id: userRef,
    title: { type: "text", notNull: true },
    start_date: { type: "date", notNull: true },
    end_date: { type: "date" },
    start_time: { type: "time" },
    end_time: { type: "time" },
    all_day: { type: "boolean", notNull: true, default: false },
    category: { type: "text", notNull: true, default: "Personal" },
    location: { type: "text", notNull: true, default: "" },
    description: { type: "text", notNull: true, default: "" },
    reminder: { type: "text", notNull: true, default: "none" },
    recurrence: { type: "text", notNull: true, default: "none" },
    recurrence_end: { type: "date" },
    custom_weekdays: { type: "integer[]", notNull: true, default: "{}" },
    overrides: { type: "jsonb", notNull: true, default: "{}" },
    created_at: timestamp(),
    updated_at: timestamp()
  });
  pgm.createIndex("calendar_events", "user_id");
  pgm.createIndex("calendar_events", ["user_id", "start_date"]);

  pgm.createTable("goals", {
    id: { type: "bigserial", primaryKey: true },
    user_id: userRef,
    name: { type: "text", notNull: true },
    current: { type: "numeric", notNull: true, default: 0 },
    target: { type: "numeric", notNull: true, default: 1 },
    created_at: timestamp(),
    updated_at: timestamp()
  });
  pgm.createIndex("goals", "user_id");

  pgm.createTable("habits", {
    id: { type: "bigserial", primaryKey: true },
    user_id: userRef,
    name: { type: "text", notNull: true },
    days: {
      type: "boolean[]",
      notNull: true,
      default: pgm.func("ARRAY[false,false,false,false,false,false,false]")
    },
    history: { type: "date[]", notNull: true, default: "{}" },
    created_at: timestamp()
  });
  pgm.createIndex("habits", "user_id");

  pgm.createTable("meals", {
    id: { type: "bigserial", primaryKey: true },
    user_id: userRef,
    date: { type: "date" },
    type: { type: "text", notNull: true, default: "Meal" },
    name: { type: "text", notNull: true, default: "" },
    time: { type: "time" },
    calories: { type: "numeric" },
    protein: { type: "numeric" },
    carbohydrates: { type: "numeric" },
    fat: { type: "numeric" },
    ingredients: { type: "text[]", notNull: true, default: "{}" },
    notes: { type: "text", notNull: true, default: "" },
    status: { type: "text", notNull: true, default: "planned" },
    day: { type: "text", notNull: true, default: "" },
    breakfast: { type: "text", notNull: true, default: "" },
    lunch: { type: "text", notNull: true, default: "" },
    dinner: { type: "text", notNull: true, default: "" },
    snack: { type: "text", notNull: true, default: "" },
    created_at: timestamp(),
    updated_at: timestamp()
  });
  pgm.createIndex("meals", "user_id");
  pgm.createIndex("meals", ["user_id", "date"]);

  pgm.createTable("grocery_items", {
    id: { type: "bigserial", primaryKey: true },
    user_id: userRef,
    name: { type: "text", notNull: true },
    category: { type: "text", notNull: true, default: "" },
    quantity: { type: "text", notNull: true, default: "" },
    note: { type: "text", notNull: true, default: "" },
    completed: { type: "boolean", notNull: true, default: false },
    created_at: timestamp()
  });
  pgm.createIndex("grocery_items", "user_id");
  pgm.createIndex("grocery_items", ["user_id", "completed"]);

  pgm.createTable("custom_reminders", {
    id: { type: "bigserial", primaryKey: true },
    user_id: userRef,
    title: { type: "text", notNull: true },
    date: { type: "date" },
    time: { type: "time" },
    note: { type: "text", notNull: true, default: "" },
    type: { type: "text", notNull: true, default: "Custom" },
    completed: { type: "boolean", notNull: true, default: false },
    created_at: timestamp()
  });
  pgm.createIndex("custom_reminders", "user_id");

  pgm.createTable("activity_log", {
    id: { type: "bigserial", primaryKey: true },
    user_id: userRef,
    name: { type: "text", notNull: true },
    status: { type: "text", notNull: true, default: "" },
    timestamp: { type: "text", notNull: true, default: "" },
    created_at: timestamp()
  });
  pgm.createIndex("activity_log", "user_id");
  pgm.createIndex("activity_log", ["user_id", "created_at"]);

  pgm.createTable("settings", {
    user_id: { type: "bigint", primaryKey: true, references: "users", onDelete: "CASCADE" },
    theme: { type: "text", notNull: true, default: "system" },
    updated_at: timestamp()
  });
};

export const down = (pgm) => {
  pgm.dropTable("settings");
  pgm.dropTable("activity_log");
  pgm.dropTable("custom_reminders");
  pgm.dropTable("grocery_items");
  pgm.dropTable("meals");
  pgm.dropTable("habits");
  pgm.dropTable("goals");
  pgm.dropTable("calendar_events");
  pgm.dropTable("notes");
  pgm.dropTable("tasks");
  pgm.dropTable("users");
};
