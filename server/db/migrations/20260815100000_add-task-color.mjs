export const up = (pgm) => {
  pgm.addColumn("tasks", {
    color: { type: "text" }
  });
};

export const down = (pgm) => {
  pgm.dropColumn("tasks", "color");
};
