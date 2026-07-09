import { useEffect, useState } from "react";
import { api, todayStr } from "../api.js";

const STATUS_COLORS = {
  Scheduled: "st-scheduled",
  CheckedIn: "st-checkedin",
  Roomed: "st-roomed",
  Completed: "st-completed",
  Cancelled: "st-cancelled",
  NoShow: "st-noshow",
};

function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export default function Dashboard() {
  const [appts, setAppts] = useState([]);
  const [summary, setSummary] = useState({ count: 0, total: 0 });
  const [copayFor, setCopayFor] = useState(null);
  const [err, setErr] = useState("");

  async function load() {
    try {
      setAppts(await api.appointments(todayStr()));
      setSummary(await api.paymentSummary());
    } catch (e) { setErr(e.message); }
  }
  useEffect(() => { load(); }, []);

  async function act(fn) {
    setErr("");
    try { await fn(); await load(); } catch (e) { setErr(e.message); }
  }

  const kpi = {
    total: appts.length,
    checkedIn: appts.filter((a) => ["CheckedIn", "Roomed"].includes(a.status)).length,
    waiting: appts.filter((a) => a.status === "CheckedIn").length,
    scheduled: appts.filter((a) => a.status === "Scheduled").length,
  };

  return (
    <div>
      <div className="page-head">
        <h1>Today at a glance</h1>
        <span className="muted">{new Date().toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}</span>
      </div>
      {err && <div className="alert">{err}</div>}

      <div className="kpi-row">
        <div className="kpi"><div className="kpi-num">{kpi.total}</div><div className="kpi-label">Appointments</div></div>
        <div className="kpi"><div className="kpi-num">{kpi.scheduled}</div><div className="kpi-label">Awaiting arrival</div></div>
        <div className="kpi"><div className="kpi-num">{kpi.waiting}</div><div className="kpi-label">In waiting room</div></div>
        <div className="kpi"><div className="kpi-num">${summary.total}</div><div className="kpi-label">Copays collected ({summary.count})</div></div>
      </div>

      <div className="card">
        <div className="card-head">Appointment board</div>
        <table className="table">
          <thead>
            <tr><th>Time</th><th>Patient</th><th>MRN</th><th>Provider</th><th>Reason</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {appts.length === 0 && <tr><td colSpan="7" className="muted center">No appointments today.</td></tr>}
            {appts.map((a) => (
              <tr key={a.id}>
                <td>{fmtTime(a.startAt)}</td>
                <td><strong>{a.patient.firstName} {a.patient.lastName}</strong></td>
                <td className="mono">{a.patient.mrn}</td>
                <td>{a.provider.fullName}</td>
                <td className="muted">{a.reason}</td>
                <td><span className={`badge ${STATUS_COLORS[a.status]}`}>{a.status}</span></td>
                <td className="row-actions">
                  {a.status === "Scheduled" && (
                    <button className="btn btn-sm btn-primary" onClick={() => act(() => api.checkIn(a.id))}>Check in</button>
                  )}
                  {a.status === "CheckedIn" && (
                    <button className="btn btn-sm" onClick={() => act(() => api.setStatus(a.id, "Roomed"))}>Room</button>
                  )}
                  {a.status === "Roomed" && (
                    <button className="btn btn-sm" onClick={() => act(() => api.setStatus(a.id, "Completed"))}>Complete</button>
                  )}
                  {["Scheduled", "CheckedIn"].includes(a.status) && (
                    <button className="btn btn-sm btn-ghost" onClick={() => setCopayFor(a)}>Copay</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {copayFor && (
        <CopayModal appt={copayFor} onClose={() => setCopayFor(null)} onDone={() => { setCopayFor(null); load(); }} />
      )}
    </div>
  );
}

function CopayModal({ appt, onClose, onDone }) {
  const [amount, setAmount] = useState(appt.patient?.insurance?.[0]?.copayAmount ?? 25);
  const [method, setMethod] = useState("Card");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function pay() {
    setBusy(true); setErr("");
    try {
      await api.pay({ patientId: appt.patient.id, encounterId: appt.encounter?.id, amount: Number(amount), type: "Copay", method });
      onDone();
    } catch (e) { setErr(e.message); setBusy(false); }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Collect copay — {appt.patient.firstName} {appt.patient.lastName}</h3>
        {err && <div className="alert">{err}</div>}
        <label>Amount ($)
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </label>
        <label>Method
          <select value={method} onChange={(e) => setMethod(e.target.value)}>
            <option>Card</option><option>Cash</option>
          </select>
        </label>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={pay} disabled={busy}>{busy ? "Processing…" : `Charge $${amount}`}</button>
        </div>
      </div>
    </div>
  );
}
