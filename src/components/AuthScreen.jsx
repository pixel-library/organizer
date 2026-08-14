import { useState } from "react";

export default function AuthScreen({ onLogin, onRegister, error = "" }) {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setLocalError("");
    if (mode === "register" && !name.trim()) {
      setLocalError("Please enter your name.");
      return;
    }
    if (!email.trim() || password.length < 8) {
      setLocalError(mode === "register"
        ? "Please enter a valid email and a password of at least 8 characters."
        : "Please enter your email and password.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "register") {
        await onRegister(name.trim(), email.trim(), password);
      } else {
        await onLogin(email.trim(), password);
      }
    } catch (err) {
      setLocalError(err.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const inputStyle = {
    display: "block",
    width: "100%",
    boxSizing: "border-box",
    marginBottom: 12,
    padding: "10px 12px",
    fontSize: 14,
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,.1)",
    background: "rgba(255,255,255,.05)",
    color: "var(--text, #eee)",
    outline: "none"
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div className="standard-panel" style={{ maxWidth: 400, width: "100%" }}>
        <div className="standard-panel-heading">
          <div>
            <span className="panel-kicker">PERSONAL WORKSPACE</span>
            <h2>{mode === "login" ? "Welcome back" : "Create your account"}</h2>
            <p>
              {mode === "login"
                ? "Sign in to access your dashboard, tasks, notes and planner data."
                : "Your data is stored securely and synced across devices."}
            </p>
          </div>
        </div>

        <form onSubmit={submit} aria-label="Authentication form">
          {mode === "register" && (
            <input
              type="text"
              placeholder="Full name"
              aria-label="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={inputStyle}
            />
          )}
          <input
            type="email"
            placeholder="Email address"
            aria-label="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            style={inputStyle}
          />
          <input
            type="password"
            placeholder="Password"
            aria-label="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            style={inputStyle}
          />
          {(localError || error) && (
            <p className="analytics-empty-state" style={{ color: "#e07b7b", marginBottom: 12, padding: 0, textAlign: "left" }}>
              {localError || error}
            </p>
          )}
          <button type="submit" className="small-primary" style={{ width: "100%" }} disabled={busy}>
            <i className="fa-solid fa-arrow-right-to-bracket"></i>
            {busy ? "Please wait…" : mode === "login" ? "Sign In" : "Create Account"}
          </button>
        </form>

        <p className="analytics-empty-state" style={{ marginTop: 16, padding: 0, textAlign: "center" }}>
          {mode === "login" ? "Don't have an account yet?" : "Already have an account?"}{" "}
          <button
            type="button"
            className="light-action-btn"
            style={{ padding: "4px 10px" }}
            onClick={() => { setMode(mode === "login" ? "register" : "login"); setLocalError(""); }}
          >
            {mode === "login" ? "Create one" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  );
}
