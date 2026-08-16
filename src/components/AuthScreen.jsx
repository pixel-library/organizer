import { useState } from "react";

export default function AuthScreen({ onLogin, onRegister, error = "" }) {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
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
    if (!username.trim() || password.length < 8) {
      setLocalError(mode === "register"
        ? "Please enter a username (3+ characters) and a password of at least 8 characters."
        : "Please enter your username and password.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "register") {
        await onRegister(name.trim(), username.trim(), password);
      } else {
        await onLogin(username.trim(), password);
      }
    } catch (err) {
      setLocalError(err.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const switchMode = (next) => {
    setMode(next);
    setLocalError("");
  };

  return (
    <div className="auth-shell">
      <div className="auth-blob auth-blob-1"></div>
      <div className="auth-blob auth-blob-2"></div>

      <div className="auth-wrap">
        <main className="auth-card" aria-label="Authentication">
          <div className="auth-brand">
            <span className="auth-logo"><span className="auth-logo-dot"></span></span>
            <h1>Life Planner</h1>
            <p>WORKSPACE OS</p>
          </div>

          <div className="auth-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "login"}
              className={`auth-tab ${mode === "login" ? "active" : ""}`}
              onClick={() => switchMode("login")}
            >
              Sign In
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "register"}
              className={`auth-tab ${mode === "register" ? "active" : ""}`}
              onClick={() => switchMode("register")}
            >
              Create Account
            </button>
          </div>

          <form onSubmit={submit} aria-label={mode === "login" ? "Sign in form" : "Create account form"}>
            {mode === "register" && (
              <div className="auth-field">
                <label htmlFor="auth-name">Full Name</label>
                <input
                  id="auth-name"
                  type="text"
                  placeholder="Your name"
                  aria-label="Full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            )}
            <div className="auth-field">
              <label htmlFor="auth-username">Username</label>
              <input
                id="auth-username"
                type="text"
                placeholder="Choose a username"
                aria-label="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck="false"
              />
            </div>
            <div className="auth-field">
              <label htmlFor="auth-password">Password</label>
              <input
                id="auth-password"
                type="password"
                placeholder={mode === "register" ? "At least 8 characters" : "Enter your password"}
                aria-label="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
              />
            </div>

            {(localError || error) && (
              <p className="auth-error" role="alert">
                <i className="fa-solid fa-circle-exclamation"></i>
                {localError || error}
              </p>
            )}

            <button type="submit" className="auth-submit" disabled={busy}>
              <i className={`fa-solid ${mode === "login" ? "fa-arrow-right-to-bracket" : "fa-user-plus"}`}></i>
              {busy ? "Please wait…" : mode === "login" ? "Sign In" : "Create Account"}
            </button>
          </form>
        </main>

        <p className="auth-footer">Your data stays yours — synced to your account.</p>
      </div>
    </div>
  );
}