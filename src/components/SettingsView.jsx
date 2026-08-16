import { useState, useEffect } from "react";
import { api, ApiError } from "../api";
import { isPushSupported, subscribeToPush, unsubscribeFromPush, getExistingPushSubscription } from "../utils/push";

function SettingsCard({ title, icon, kicker, children }) {
  return (
    <div className="admin-card settings-card">
      <div className="panel-heading settings-heading">
        <span className="panel-kicker"><i className={`fa-solid ${icon}`}></i> {kicker}</span>
        <h3>{title}</h3>
      </div>
      {children}
    </div>
  );
}

function useAction(okText) {
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const run = async (fn) => {
    setBusy(true);
    setStatus(null);
    try {
      const data = await fn();
      setStatus({ kind: "ok", text: data?.message || okText });
      return true;
    } catch (err) {
      setStatus({ kind: "error", text: err instanceof ApiError ? err.message : "Request failed" });
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { status, busy, run };
}

const StatusNote = ({ status }) =>
  status ? (
    <p className={`admin-help ${status.kind === "error" ? "danger-help" : ""}`}>{status.text}</p>
  ) : null;

export default function SettingsView({ user, settings, setSettings, onExport, onImport, onLogout }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState("");

  const pass = useAction("Password updated. Other devices signed out.");
  const revoke = useAction("Other sessions revoked.");
  const del = useAction("Account deleted.");

  const changePassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) return;
    const ok = await pass.run(() => api.post("/auth/change-password", { currentPassword, newPassword }));
    if (ok) {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }
  };

  const deleteAccount = async (e) => {
    e.preventDefault();
    if (deleteConfirm.trim().toLowerCase() !== "delete") return;
    const ok = await del.run(() => api.del("/auth/account"));
    if (ok) onLogout();
  };

  const [notifStatus, setNotifStatus] = useState(null);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isPushSupported()) return;
      try {
        const sub = await getExistingPushSubscription();
        if (!cancelled) setPushEnabled(Boolean(sub));
      } catch {
        /* SW not ready yet */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const notifSupported = typeof Notification !== "undefined";
  const notifEnabled = notifSupported && Notification.permission === "granted";

  const enableNotifications = async () => {
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setNotifStatus({ kind: "error", text: "Notification permission was denied." });
        return;
      }
    } catch {
      /* permission request unsupported */
    }
  };

  const togglePush = async () => {
    setPushBusy(true);
    setNotifStatus(null);
    try {
      if (pushEnabled) {
        await unsubscribeFromPush();
        setPushEnabled(false);
        setNotifStatus({ kind: "ok", text: "Push notifications disabled." });
      } else {
        if (notifSupported && Notification.permission !== "granted") {
          const perm = await Notification.requestPermission();
          if (perm !== "granted") {
            setNotifStatus({ kind: "error", text: "Notification permission is required for push." });
            return;
          }
        }
        await subscribeToPush();
        setPushEnabled(true);
        setNotifStatus({ kind: "ok", text: "Push notifications enabled. Reminders will arrive even when the app is closed." });
      }
    } catch (err) {
      setNotifStatus({
        kind: "error",
        text: err instanceof ApiError ? err.message : "Push setup failed (HTTPS is required)."
      });
    } finally {
      setPushBusy(false);
    }
  };

  return (
    <section id="view-settings" className="view-section admin-panel settings-view">
      <div className="admin-stack">
        <SettingsCard title="Profile" icon="fa-solid fa-user" kicker="ACCOUNT">
          <div className="admin-row">
            <span className="admin-label">Name</span>
            <span className="admin-value">{user?.name || "—"}</span>
          </div>
          <div className="admin-row">
            <span className="admin-label">Username</span>
            <span className="admin-value">{user?.username || "—"}</span>
          </div>
          <div className="admin-row">
            <span className="admin-label">Role</span>
            <span className={`admin-role ${user?.role}`}>{user?.role || "user"}</span>
          </div>
        </SettingsCard>

        <SettingsCard title="Appearance" icon="fa-solid fa-palette" kicker="PREFERENCES">
          <div className="admin-row">
            <span className="admin-label">Theme</span>
            <select
              className="admin-select settings-select"
              value={settings.theme || "system"}
              onChange={(e) => setSettings({ ...settings, theme: e.target.value })}
            >
              <option value="dark">Dark</option>
              <option value="light">Light</option>
              <option value="system">System default</option>
            </select>
          </div>
          {notifSupported && (
            <div className="admin-row">
              <span className="admin-label">Notifications</span>
              {notifEnabled ? (
                <span className="admin-status">Enabled</span>
              ) : (
                <button type="button" className="task-tool-btn" onClick={enableNotifications}>
                  <i className="fa-solid fa-bell"></i> Enable task reminders
                </button>
              )}
            </div>
          )}
          {isPushSupported() && (
            <div className="admin-row">
              <span className="admin-label">Push alerts</span>
              <button
                type="button"
                className="task-tool-btn"
                onClick={togglePush}
                disabled={pushBusy}
              >
                <i className={`fa-solid ${pushEnabled ? "fa-bell-slash" : "fa-bell"}`}></i>{" "}
                {pushBusy ? "Working…" : pushEnabled ? "Disable push alerts" : "Enable push alerts"}
              </button>
              <span className="admin-status">{pushEnabled ? "Active" : "Off"}</span>
            </div>
          )}
          <StatusNote status={notifStatus} />
        </SettingsCard>

        <SettingsCard title="Change password" icon="fa-solid fa-key" kicker="SECURITY">
          <form className="admin-form" onSubmit={changePassword}>
            <div className="admin-row">
              <span className="admin-label">Current password</span>
              <input
                className="admin-input"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>
            <div className="admin-row">
              <span className="admin-label">New password</span>
              <input
                className="admin-input"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={8}
                maxLength={72}
                required
              />
            </div>
            <div className="admin-row">
              <span className="admin-label">Confirm new password</span>
              <input
                className="admin-input"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
            {newPassword !== confirmPassword && confirmPassword !== "" && (
              <p className="admin-help danger-help">Passwords do not match.</p>
            )}
            <div className="admin-row">
              <span className="admin-label"></span>
              <button type="submit" className="task-tool-btn" disabled={pass.busy}>
                {pass.busy ? "Updating…" : "Update password"}
              </button>
            </div>
            <StatusNote status={pass.status} />
          </form>
          <div className="admin-row">
            <span className="admin-label">Sessions</span>
            <button type="button" className="task-tool-btn" disabled={revoke.busy} onClick={() => revoke.run(() => api.post("/auth/revoke-sessions"))}>
              {revoke.busy ? "Revoking…" : "Sign out all other devices"}
            </button>
          </div>
          <StatusNote status={revoke.status} />
        </SettingsCard>

        <SettingsCard title="Your data" icon="fa-solid fa-database" kicker="DATA">
          <div className="admin-row">
            <span className="admin-label">Export / import</span>
            <span className="admin-actions">
              <button type="button" className="task-tool-btn" onClick={onExport}>
                <i className="fa-solid fa-download"></i> Export
              </button>
              <button type="button" className="task-tool-btn" onClick={onImport}>
                <i className="fa-solid fa-upload"></i> Import
              </button>
            </span>
          </div>
          <p className="admin-help">Exports a single JSON file with all your planner data.</p>
        </SettingsCard>

        <SettingsCard title="Danger zone" icon="fa-solid fa-triangle-exclamation" kicker="ACCOUNT">
          <form className="admin-form" onSubmit={deleteAccount}>
            <p className="admin-help danger-help">
              Deleting your account removes your server-side data permanently. Type <b>delete</b> to confirm.
            </p>
            <div className="admin-row">
              <span className="admin-label">Confirm</span>
              <input
                className="admin-input"
                type="text"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder="type delete"
                required
              />
            </div>
            <div className="admin-row">
              <span className="admin-label"></span>
              <button
                type="submit"
                className="task-tool-btn danger"
                disabled={del.busy || deleteConfirm.trim().toLowerCase() !== "delete"}
              >
                {del.busy ? "Deleting…" : "Delete account"}
              </button>
            </div>
            <StatusNote status={del.status} />
          </form>
        </SettingsCard>
      </div>
    </section>
  );
}