import { config } from "./config.js";

let connection = null;

export async function connectDatabase() {
  // Placeholder: a real database driver and connection lifecycle will be
  // implemented in a later phase. The health endpoint reports this state.
  connection = {
    configured: Boolean(config.db.url || config.db.user),
    connected: false,
    provider: "none"
  };
  return connection;
}

export function getDatabaseStatus() {
  return connection || {
    configured: Boolean(config.db.url || config.db.user),
    connected: false,
    provider: "none"
  };
}

export async function disconnectDatabase() {
  connection = null;
}
