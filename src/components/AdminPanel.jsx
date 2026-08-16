import { useState, useEffect, useCallback } from "react";
import { api, ApiError, API_BASE } from "../api";

const TABS = [
  { id: "overview", icon: "fa-solid fa-gauge-high", label: "Overview" },
  { id: "users", icon: "fa-solid fa-users", label: "Users" },
  { id: "sessions", icon: "fa-solid fa-right-to-bracket", label: "Sessions" },
  { id: "activity", icon: "fa-solid fa-clock-rotate-left", label: "Activity" },
  { id: "data", icon: "fa-solid fa-table", label: "Data" },
  { id: "backup", icon: "fa-solid fa-floppy-disk", label: "Backup" }
];

const DATA_TABLES = [
  "users", "sessions", "tasks", "notes", "calendar_events", "goals", "habits",
  "meals", "grocery_items", "custom_reminders", "activity_log", "settings"
];

const fmtDate = (v) => {
  if (!v) return "—";
  return new Date(v).toLocaleString();
};

const esc = (v) => String(v ?? "");
const cellValue = (v) => {
  if (v === null || v === undefined) return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
};

function useAdminFetch(path, deps) {
  const [state, setState] = useState({ data: null, error: "", loading: true });
  useEffect(() => {
    let cancelled = false;
    api.get(path)
      .then(data => { if (!cancelled) setState({ data, error: "", loading: false }); })
      .catch(err => { if (!cancelled) setState({ data: null, error: err.message, loading: false }); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}

export default function AdminPanel({ user }) {
  const [tab, setTab] = useState("overview");
  const [message, setMessage] = useState(null);

  useEffect(() => {
    const openBackup = () => setTab("backup");
    window.addEventListener("admin-open-backup", openBackup);
    return () => window.removeEventListener("admin-open-backup", openBackup);
  }, []);

  const flash = useCallback((text, kind = "ok") => {
    setMessage({ text, kind });
    setTimeout(() => setMessage(null), 4000);
  }, []);

  const run = useCallback(async (fn, okText) => {
    try {
      await fn();
      if (okText) flash(okText);
      return true;
    } catch (err) {
      flash(err instanceof ApiError ? err.message : "Request failed", "error");
      return false;
    }
  }, [flash]);

  return (
    <section id="view-admin" className="view-section admin-panel">
      <div className="admin-tabs">
        {TABS.map(t => (
          <button
            key={t.id}
            type="button"
            className={`admin-tab ${tab === t.id ? "active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            <i className={t.icon}></i>
            {t.label}
          </button>
        ))}
      </div>
      {message && <div className={`admin-toast ${message.kind}`}>{message.text}</div>}
      {tab === "overview" && <OverviewTab onExport={flash} />}
      {tab === "users" && <UsersTab currentUserId={user?.id} run={run} />}
      {tab === "sessions" && <SessionsTab run={run} />}
      {tab === "activity" && <ActivityTab />}
      {tab === "data" && <DataTab />}
      {tab === "backup" && <BackupTab flash={flash} />}
    </section>
  );
}

/* ---------------- Overview ---------------- */

function OverviewTab({ onExport }) {
  const { data, error, loading } = useAdminFetch("/admin/stats", []);
  const [exporting, setExporting] = useState(false);

  const downloadExport = async () => {
    setExporting(true);
    try {
      const res = await fetch(`${API_BASE}/admin/export`, { credentials: "include" });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `life-organizer-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      onExport("Export downloaded");
    } catch (err) {
      onExport(err.message, "error");
    } finally {
      setExporting(false);
    }
  };

  if (loading) return <div className="empty-state">Loading stats…</div>;
  if (error) return <div className="empty-state">{error}</div>;

  const statCard = (label, value, sub = "") => (
    <div className="admin-stat-card">
      <span className="panel-kicker">{label}</span>
      <strong>{value}</strong>
      {sub && <small>{sub}</small>}
    </div>
  );

  return (
    <div className="admin-stack">
      <div className="admin-stats-grid">
        {statCard("USERS", data.users.total, `${data.users.admins} admins`)}
        {statCard("NEW USERS (7D)", data.users.new_last_7d)}
        {statCard("SESSIONS", data.sessions.total, `${data.sessions.active} active`)}
        {statCard("ACTIVE SESSIONS", data.sessions.active, `${data.sessions.expired} expired`)}
      </div>
      <div className="standard-panel admin-card">
        <div className="panel-heading">
          <div>
            <span className="panel-kicker">DATA STORES</span>
            <h3>Rows per table</h3>
          </div>
          <button type="button" className="small-primary" onClick={downloadExport} disabled={exporting}>
            <i className="fa-solid fa-file-arrow-down"></i> {exporting ? "Exporting…" : "Export JSON"}
          </button>
        </div>
        <div className="admin-table-grid">
          {data.tables.map(t => (
            <div key={t.name} className="admin-table-chip">
              <span>{t.name}</span>
              <strong>{t.rows}</strong>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Users ---------------- */

function UsersTab({ currentUserId, run }) {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("created_at");
  const [dir, setDir] = useState("desc");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const perPage = 25;

  const load = useCallback(async (opts = {}) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(opts.page ?? page),
        perPage: String(perPage),
        search: opts.search ?? search,
        sort: opts.sort ?? sort,
        dir: opts.dir ?? dir
      });
      const data = await api.get(`/admin/users?${params}`);
      setRows(data.rows);
      setTotal(data.total);
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, search, sort, dir]);

  useEffect(() => { load(); }, [load]);

  const submitSearch = () => { setPage(1); load({ page: 1 }); };
  const changeSort = (col) => {
    if (sort === col) { setDir(d => (d === "asc" ? "desc" : "asc")); load({ sort: col, dir: dir === "asc" ? "desc" : "asc" }); }
    else { setSort(col); setDir("desc"); load({ sort: col, dir: "desc" }); }
  };
  const goPage = (p) => { setPage(p); load({ page: p }); };

  const changeRole = (id, role) => run(async () => {
    await api.patch(`/admin/users/${id}/role`, { role });
  }, "Role updated").then(ok => { if (ok) load(); });

  const deleteUser = (u) => {
    if (!confirm(`Delete user "${u.username}"? All their data will be removed.`)) return;
    run(async () => { await api.del(`/admin/users/${idOf(u)}`); }, "User deleted").then(ok => { if (ok) load(); });
  };

  const idOf = (u) => (typeof u.id === "string" && /^\d+$/.test(u.id)) ? Number(u.id) : u.id;

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  return (
    <div className="standard-panel admin-card">
      <div className="panel-heading">
        <div>
          <span className="panel-kicker">ACCOUNTS</span>
          <h3>Users · {total}</h3>
        </div>
        <input
          className="admin-search"
          placeholder="Search name or @username…"
          value={search}
          aria-label="Search users"
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") submitSearch(); }}
        />
      </div>
      {error && <div className="empty-state">{error}</div>}
      {loading ? <div className="empty-state">Loading users…</div> : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th className="sortable" onClick={() => changeSort("username")}>Username {sort === "username" && <i className={`fa-solid fa-arrow-${dir === "asc" ? "up" : "down"}-wide-short`}></i>}</th>
                <th className="sortable" onClick={() => changeSort("name")}>Name</th>
                <th className="sortable" onClick={() => changeSort("role")}>Role</th>
                <th>Active sessions</th>
                <th>Last seen</th>
                <th className="sortable" onClick={() => changeSort("created_at")}>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(u => (
                <tr key={u.id}>
                  <td className="admin-mono">{esc(u.id)}</td>
                  <td><strong>@{esc(u.username)}</strong>{idOf(u) === currentUserId && <span className="admin-you">you</span>}</td>
                  <td>{esc(u.name)}</td>
                  <td>
                    <span className={`admin-role ${u.role === "admin" ? "admin" : "user"}`}>{esc(u.role)}</span>
                  </td>
                  <td>{u.active_sessions}</td>
                  <td>{fmtDate(u.last_seen_at)}</td>
                  <td>{fmtDate(u.created_at)}</td>
                  <td className="admin-actions">
                    {u.role !== "admin" ? (
                      <button type="button" className="task-tool-btn" title="Promote to admin" onClick={() => changeRole(idOf(u), "admin")}>
                        <i className="fa-solid fa-user-shield"></i>
                      </button>
                    ) : (
                      <button type="button" className="task-tool-btn" title="Demote to user" onClick={() => changeRole(idOf(u), "user")} disabled={idOf(u) === currentUserId}>
                        <i className="fa-solid fa-user-minus"></i>
                      </button>
                    )}
                    <button type="button" className="task-tool-btn danger" title="Delete user" onClick={() => deleteUser(u)} disabled={idOf(u) === currentUserId}>
                      <i className="fa-solid fa-trash"></i>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {totalPages > 1 && (
        <div className="admin-pager">
          <button type="button" className="task-tool-btn" disabled={page <= 1} onClick={() => goPage(page - 1)}>
            <i className="fa-solid fa-chevron-left"></i>
          </button>
          <span>{page} / {totalPages}</span>
          <button type="button" className="task-tool-btn" disabled={page >= totalPages} onClick={() => goPage(page + 1)}>
            <i className="fa-solid fa-chevron-right"></i>
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------------- Sessions ---------------- */

function SessionsTab({ run }) {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const perPage = 25;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get(`/admin/sessions?page=${page}&perPage=${perPage}`);
      setRows(data.rows);
      setTotal(data.total);
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { load(); }, [load]);

  const revoke = (id) => run(async () => {
    await api.post(`/admin/sessions/${id}/revoke`);
  }, "Session revoked").then(ok => { if (ok) load(); });

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  return (
    <div className="standard-panel admin-card">
      <div className="panel-heading">
        <div>
          <span className="panel-kicker">SESSIONS</span>
          <h3>Active logins · {total}</h3>
        </div>
      </div>
      {error && <div className="empty-state">{error}</div>}
      {loading ? <div className="empty-state">Loading sessions…</div> : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>User</th>
                <th>Created</th>
                <th>Last seen</th>
                <th>Expires</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(s => (
                <tr key={s.id}>
                  <td className="admin-mono">{esc(s.id)}</td>
                  <td><strong>@{esc(s.username)}</strong> <small>{esc(s.name)}</small></td>
                  <td>{fmtDate(s.created_at)}</td>
                  <td>{fmtDate(s.last_seen_at)}</td>
                  <td>{fmtDate(s.expires_at)}</td>
                  <td><span className={`admin-role ${s.expired ? "user" : "admin"}`}>{s.expired ? "expired" : "active"}</span></td>
                  <td className="admin-actions">
                    <button type="button" className="task-tool-btn danger" title="Revoke session" onClick={() => revoke(s.id)} disabled={s.expired}>
                      <i className="fa-solid fa-ban"></i>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {totalPages > 1 && (
        <div className="admin-pager">
          <button type="button" className="task-tool-btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            <i className="fa-solid fa-chevron-left"></i>
          </button>
          <span>{page} / {totalPages}</span>
          <button type="button" className="task-tool-btn" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
            <i className="fa-solid fa-chevron-right"></i>
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------------- Activity ---------------- */

function ActivityTab() {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const perPage = 30;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), perPage: String(perPage), search });
      const data = await api.get(`/admin/activity?${params}`);
      setRows(data.rows);
      setTotal(data.total);
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  const submitSearch = () => { setPage(1); load(); };
  const totalPages = Math.max(1, Math.ceil(total / perPage));

  return (
    <div className="standard-panel admin-card">
      <div className="panel-heading">
        <div>
          <span className="panel-kicker">ACTIVITY LOG</span>
          <h3>Events · {total}</h3>
        </div>
        <input
          className="admin-search"
          placeholder="Search name, status or user…"
          value={search}
          aria-label="Search activity"
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") submitSearch(); }}
        />
      </div>
      {error && <div className="empty-state">{error}</div>}
      {loading ? <div className="empty-state">Loading activity…</div> : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>User</th>
                <th>Event</th>
                <th>Item</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(a => (
                <tr key={a.id}>
                  <td className="admin-mono">{esc(a.id)}</td>
                  <td><strong>@{esc(a.user_username)}</strong></td>
                  <td><span className="admin-status">{esc(a.status)}</span></td>
                  <td>{esc(a.name)}</td>
                  <td>{fmtDate(a.timestamp || a.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {totalPages > 1 && (
        <div className="admin-pager">
          <button type="button" className="task-tool-btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            <i className="fa-solid fa-chevron-left"></i>
          </button>
          <span>{page} / {totalPages}</span>
          <button type="button" className="task-tool-btn" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
            <i className="fa-solid fa-chevron-right"></i>
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------------- Data browser ---------------- */

function DataTab() {
  const [table, setTable] = useState("tasks");
  const [columns, setColumns] = useState([]);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("");
  const [sort, setSort] = useState("");
  const [dir, setDir] = useState("desc");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const perPage = 30;

  const load = useCallback(async (opts = {}) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(opts.page ?? page),
        perPage: String(perPage),
        search: opts.search ?? search,
        filter: opts.filter ?? filter,
        sort: opts.sort ?? sort,
        dir: opts.dir ?? dir
      });
      const data = await api.get(`/admin/data/${table}?${params}`);
      setColumns(data.columns);
      setRows(data.rows);
      setTotal(data.total);
      setSort(data.sort);
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [table, page, search, filter, sort, dir]);

  useEffect(() => { load(); }, [load]);

  const switchTable = (t) => { setTable(t); setPage(1); setSearch(""); setFilter(""); setSort(""); };
  const submitSearch = () => { setPage(1); load({ page: 1 }); };
  const submitFilter = () => { setPage(1); load({ page: 1 }); };
  const goPage = (p) => { setPage(p); load({ page: p }); };

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  return (
    <div className="standard-panel admin-card">
      <div className="panel-heading">
        <div>
          <span className="panel-kicker">DATA BROWSER</span>
          <h3>{table} · {total} rows</h3>
        </div>
      </div>
      <div className="admin-data-controls">
        <select value={table} aria-label="Choose table" onChange={e => switchTable(e.target.value)} className="admin-select">
          {DATA_TABLES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <input className="admin-search" placeholder="Search by id…" value={search} aria-label="Search rows"
          onChange={e => setSearch(e.target.value)} onKeyDown={e => { if (e.key === "Enter") submitSearch(); }} />
        <input className="admin-search" placeholder="Filter col=value or col~text" value={filter} aria-label="Filter rows"
          onChange={e => setFilter(e.target.value)} onKeyDown={e => { if (e.key === "Enter") submitFilter(); }} />
      </div>
      {error && <div className="empty-state">{error}</div>}
      {loading ? <div className="empty-state">Loading {table}…</div> : (
        <div className="admin-table-wrap">
          <table className="admin-table data-table">
            <thead>
              <tr>
                {columns.map(c => (
                  <th key={c} className="sortable" onClick={() => {
                    if (sort === c) { setDir(d => (d === "asc" ? "desc" : "asc")); load({ sort: c, dir: dir === "asc" ? "desc" : "asc" }); }
                    else { setSort(c); setDir("desc"); load({ sort: c, dir: "desc" }); }
                  }}>
                    {c}{sort === c && <i className={`fa-solid fa-arrow-${dir === "asc" ? "up" : "down"}-wide-short`}></i>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id ?? JSON.stringify(r)}>
                  {columns.map(c => <td key={c}>{cellValue(r[c])}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {totalPages > 1 && (
        <div className="admin-pager">
          <button type="button" className="task-tool-btn" disabled={page <= 1} onClick={() => goPage(page - 1)}>
            <i className="fa-solid fa-chevron-left"></i>
          </button>
          <span>{page} / {totalPages}</span>
          <button type="button" className="task-tool-btn" disabled={page >= totalPages} onClick={() => goPage(page + 1)}>
            <i className="fa-solid fa-chevron-right"></i>
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------------- Backup / Restore ---------------- */

function BackupTab({ flash }) {
  const [passphrase, setPassphrase] = useState("");
  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreFile, setRestoreFile] = useState(null);
  const [restorePassphrase, setRestorePassphrase] = useState("");
  const [restoreJson, setRestoreJson] = useState("");

  const downloadBackup = async () => {
    if (passphrase.length < 8) { flash("Passphrase must be at least 8 characters", "error"); return; }
    setBackingUp(true);
    try {
      const res = await fetch(`${API_BASE}/admin/backup`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ passphrase })
      });
      if (!res.ok) {
        let msg = "Backup failed";
        try { msg = (await res.json())?.error?.message || msg; } catch { /* ignore */ }
        throw new Error(msg);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `backup-${new Date().toISOString().slice(0, 10)}.lzb`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      flash("Encrypted backup downloaded");
    } catch (err) {
      flash(err.message, "error");
    } finally {
      setBackingUp(false);
    }
  };

  const doRestore = async () => {
    const isFile = restoreFile && (restoreFile.name.endsWith(".lzb") || restoreFile.name.endsWith(".json"));
    if (!isFile && !restoreJson.trim()) { flash("Choose a .lzb / .json file or paste JSON data", "error"); return; }
    if (!confirm("Restore REPLACES all current data in the database. Continue?")) return;
    setRestoring(true);
    try {
      let body;
      if (isFile) {
        const text = await restoreFile.text();
        if (restoreFile.name.endsWith(".lzb")) {
          body = { file: btoa(unescape(encodeURIComponent(text))), passphrase: restorePassphrase };
        } else {
          body = { data: text };
        }
      } else {
        body = { data: restoreJson };
      }
      const result = await api.post("/admin/restore", body);
      const parts = (result.restored || []).map(r => `${r.name}(${r.rows})`).join(", ");
      flash(`Restore complete: ${parts}`, "ok");
    } catch (err) {
      flash(err.message, "error");
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="admin-stack">
      <div className="standard-panel admin-card">
        <div className="panel-heading">
          <div>
            <span className="panel-kicker">ENCRYPTED BACKUP</span>
            <h3>Download .lzb backup</h3>
          </div>
        </div>
        <p className="admin-help">AES-256-GCM encrypted snapshot of the whole database. Keep the passphrase safe — it cannot be recovered.</p>
        <div className="admin-row">
          <input
            type="password"
            className="admin-input"
            placeholder="Passphrase (min 8 chars)"
            aria-label="Backup passphrase"
            value={passphrase}
            onChange={e => setPassphrase(e.target.value)}
          />
          <button type="button" className="small-primary" onClick={downloadBackup} disabled={backingUp}>
            <i className="fa-solid fa-floppy-disk"></i> {backingUp ? "Backing up…" : "Create backup"}
          </button>
        </div>
        <div className="panel-heading" style={{ marginTop: 20 }}>
          <div>
            <span className="panel-kicker">PLAINTEXT EXPORT</span>
            <h3>JSON dump</h3>
          </div>
        </div>
        <p className="admin-help">Unencrypted JSON export — available from the Overview tab (Export JSON).</p>
      </div>

      <div className="standard-panel admin-card">
        <div className="panel-heading">
          <div>
            <span className="panel-kicker">RESTORE</span>
            <h3>Replace database from backup</h3>
          </div>
        </div>
        <p className="admin-help danger-help">This truncates all tables and re-imports the backup. Your current session is preserved.</p>
        <div className="admin-row">
          <input
            type="file"
            accept=".lzb,.json,application/json"
            aria-label="Restore file"
            onChange={e => setRestoreFile(e.target.files?.[0] || null)}
          />
          <input
            type="password"
            className="admin-input"
            placeholder="Passphrase (for .lzb files)"
            aria-label="Restore passphrase"
            value={restorePassphrase}
            onChange={e => setRestorePassphrase(e.target.value)}
          />
        </div>
        <div className="admin-row">
          <textarea
            className="admin-input admin-textarea"
            placeholder="…or paste a JSON dump directly"
            aria-label="Restore JSON"
            value={restoreJson}
            onChange={e => setRestoreJson(e.target.value)}
            rows={4}
          />
        </div>
        <button type="button" className="danger-btn" onClick={doRestore} disabled={restoring}>
          <i className="fa-solid fa-rotate-left"></i> {restoring ? "Restoring…" : "Restore database"}
        </button>
      </div>
    </div>
  );
}