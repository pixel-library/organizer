import { parseArgs } from "node:util";
import bcrypt from "bcryptjs";
import { configPath, loadConfig, saveConfig, promptText, promptHidden } from "./admin-utils.js";

const { values } = parseArgs({
  options: {
    username: { type: "string" },
    password: { type: "string" },
    config: { type: "string" }
  },
  strict: false
});

const file = configPath(values.config);

if (loadConfig(file)) {
  console.error(`Admin account already exists at:\n  ${file}\nDelete that file to reset it.`);
  process.exit(1);
}

const username = values.username ?? (await promptText("Create admin username: "));
const password = values.password ?? (await promptHidden("Create admin password: "));

if (!username) {
  console.error("Username is required.");
  process.exit(1);
}
if (!password || password.length < 8) {
  console.error("Password must be at least 8 characters.");
  process.exit(1);
}

const passwordHash = await bcrypt.hash(password, 12);
saveConfig(file, {
  version: 1,
  username,
  passwordHash,
  createdAt: new Date().toISOString()
});

console.log("Admin account saved.");
console.log(`Config: ${file}`);
