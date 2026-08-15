export const TASK_COLORS = [
  { value: "#313575", label: "Deep Indigo" },
  { value: "#321951", label: "Deep Purple" },
  { value: "#633090", label: "Purple" },
  { value: "#B22E37", label: "Red" },
  { value: "#F68318", label: "Orange" },
  { value: "#FDC005", label: "Yellow" }
];

export const contrastText = (hex) => {
  if (!hex) return "#ffffff";
  const h = String(hex).replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return "#ffffff";
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.55 ? "#393F4B" : "#ffffff";
};
