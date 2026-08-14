export const up = (pgm) => {
  pgm.addColumns("goals", {
    unit: { type: "text", notNull: true, default: "" }
  });
  pgm.addColumns("grocery_items", {
    unit: { type: "text", notNull: true, default: "" }
  });
};

export const down = (pgm) => {
  pgm.dropColumns("grocery_items", ["unit"]);
  pgm.dropColumns("goals", ["unit"]);
};
