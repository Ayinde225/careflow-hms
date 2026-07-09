import { useEffect, useState } from "react";
import { api } from "../api.js";

export default function Patients() {
  const [q, setQ] = useState("");
  const [list, setList] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [err, setErr] = useState("");
  const [flash, setFlash] = useState("");

  async function load() {
    try { setList(await api.patients(q)); } catch (e) { setErr(e.message); }
  }
  useEffect(() => { load(); }, []);

  return (
    <div>
      <div className="page-head">
        <h1>Patients</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Register patient</button>
      </div>
      {err && <div className="alert">{err}</div>}
      {flash && <div className="flash">{flash}</div>}

      <div className="searchbar">
        <input placeholder="Search by name, MRN or phone…" value={q}
          onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} />
        <button className="btn" onClick={load}>Search</button>
      </div>

      <div className="card">
        <table className="table">
          <thead><tr><th>MRN</th><th>Name</th><th>DOB</th><th>Insurance</th><th>Status</th></tr></thead>
          <tbody>
            {list.length === 0 && <tr><td colSpan="5" className="muted center">No patients found.</td></tr>}
            {list.map((p) => (
              <tr key={p.id}>
                <td className="mono">{p.mrn}</td>
                <td><strong>{p.firstName} {p.lastName}</strong> <span className="muted">· {p.sex}</span></td>
                <td>{new Date(p.dob).toLocaleDateString()}</td>
                <td>{p.insurance?.[0]?.payerName || <span className="muted">—</span>}</td>
                <td>
                  {p.insurance?.[0]
                    ? <span className={`badge ${p.insurance[0].verificationStatus === "Verified" ? "st-completed" : "st-scheduled"}`}>{p.insurance[0].verificationStatus}</span>
                    : <span className="muted">No insurance</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <RegisterModal
          onClose={() => setShowForm(false)}
          onDone={(p) => { setShowForm(false); setFlash(`Registered ${p.firstName} ${p.lastName} · ${p.mrn}`); load(); }}
        />
      )}
    </div>
  );
}

function RegisterModal({ onClose, onDone }) {
  const [f, setF] = useState({
    firstName: "", lastName: "", dob: "", sex: "Female", phone: "", email: "", address: "",
    payerName: "", memberId: "", planType: "PPO", copayAmount: 25,
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      const patient = await api.createPatient({
        firstName: f.firstName, lastName: f.lastName, dob: f.dob, sex: f.sex,
        phone: f.phone, email: f.email, address: f.address,
        insurance: f.payerName ? { payerName: f.payerName, memberId: f.memberId, planType: f.planType, copayAmount: Number(f.copayAmount) } : undefined,
      });
      onDone(patient);
    } catch (e) { setErr(e.message); setBusy(false); }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal modal-wide" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h3>Register new patient</h3>
        {err && <div className="alert">{err}</div>}
        <div className="grid2">
          <label>First name<input value={f.firstName} onChange={set("firstName")} required /></label>
          <label>Last name<input value={f.lastName} onChange={set("lastName")} required /></label>
          <label>Date of birth<input type="date" value={f.dob} onChange={set("dob")} required /></label>
          <label>Sex
            <select value={f.sex} onChange={set("sex")}><option>Female</option><option>Male</option><option>Other</option></select>
          </label>
          <label>Phone<input value={f.phone} onChange={set("phone")} /></label>
          <label>Email<input type="email" value={f.email} onChange={set("email")} /></label>
          <label className="span2">Address<input value={f.address} onChange={set("address")} /></label>
        </div>
        <div className="section-label">Insurance (optional)</div>
        <div className="grid2">
          <label>Payer<input value={f.payerName} onChange={set("payerName")} placeholder="Blue Cross…" /></label>
          <label>Member ID<input value={f.memberId} onChange={set("memberId")} /></label>
          <label>Plan
            <select value={f.planType} onChange={set("planType")}><option>PPO</option><option>HMO</option><option>Medicare</option><option>Medicaid</option><option>Self-Pay</option></select>
          </label>
          <label>Copay ($)<input type="number" value={f.copayAmount} onChange={set("copayAmount")} /></label>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={busy}>{busy ? "Saving…" : "Register & assign MRN"}</button>
        </div>
      </form>
    </div>
  );
}
