import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth.jsx";

const DEMO = [
  { label: "Receptionist", email: "reception@careflow.dev", password: "reception123" },
  { label: "Admin", email: "admin@careflow.dev", password: "admin123" },
  { label: "Doctor", email: "dr.hart@careflow.dev", password: "doctor123" },
];

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("reception@careflow.dev");
  const [password, setPassword] = useState("reception123");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <div className="login-brand"><span className="brand-mark">✚</span> CareFlow</div>
        <p className="login-tag">Hospital Management System — Reception</p>
        {error && <div className="alert">{error}</div>}
        <label>Email
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="username" />
        </label>
        <label>Password
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="current-password" />
        </label>
        <button className="btn btn-primary" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
        <div className="demo-row">
          {DEMO.map((d) => (
            <button type="button" key={d.email} className="chip"
              onClick={() => { setEmail(d.email); setPassword(d.password); }}>
              {d.label}
            </button>
          ))}
        </div>
      </form>
    </div>
  );
}
