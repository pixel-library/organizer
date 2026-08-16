/**
 * Add user roles (user/admin) for the web admin panel.
 */
export const up = (pgm) => {
  pgm.addColumn("users", {
    role: {
      type: "text",
      notNull: true,
      default: "user",
      check: "role IN ('user', 'admin')"
    }
  });
  pgm.createIndex("users", "role");
};

export const down = (pgm) => {
  pgm.dropIndex("users", "role");
  pgm.dropColumn("users", "role");
};
