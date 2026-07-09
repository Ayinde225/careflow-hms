import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api.js";

const dt = (iso) => new Date(iso).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
const dtt = (iso) => new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

// ---------------- Home ----------------
export function PortalHome() {
  const [me, setMe] = useState(null);
  const [appts, setAppts] = useState([]);
  const [results, setResults] = useState([]);
  const [msgs, setMsgs] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        setMe(await api.portalMe());
        setAppts(await api.portalAppointments());
        setResults(await api.portalResults());
        setMsgs(await api.portalMessages());
      } catch (e) { /* noop */ }
    })();
  }, []);

  const upcoming = appts.filter((a) => new Date(a.startAt) >= new Date() && a.status !== "Cancelled");
  const unread = msgs.filter((m) => m.sender === "CareTeam");

  return (
    <div>
      <h1 className="portal-h1">Welcome{me ? `, ${me.firstName}` : ""} 👋</h1>
      <p className="muted">Here's a summary of your care.</p>

      <div className="portal-tiles">
        <button className="ptile" onClick={() => navigate("/visits")}>
          <div className="ptile-num">{appts.filter((a) => a.status === "Completed").length}</div>
          <div className="ptile-label">Past visits</div>
        </button>
        <button className="ptile" onClick={() => navigate("/results")}>
          <div className="ptile-num">{results.length}</div>
          <div className="ptile-label">Test results</div>
        </button>
        <button className="ptile" onClick={() => navigate("/messages")}>
          <div className="ptile-num">{unread.length}</div>
          <div className="ptile-label">Messages</div>
        </button>
      </div>

      <div className="pcard">
        <h3>Upcoming appointments</h3>
        {upcoming.length === 0 && <p className="muted">No upcoming appointments.</p>}
        {upcoming.map((a) => (
          <div key={a.id} className="pcard-row">
            <div><strong>{dtt(a.startAt)}</strong><div className="muted">{a.provider.fullName} · {a.department.name} · {a.reason}</div></div>
            <span className="badge st-scheduled">{a.status}</span>
          </div>
        ))}
      </div>

      {unread.length > 0 && (
        <div className="pcard">
          <h3>Latest message from your care team</h3>
          <p>{unread[unread.length - 1].body}</p>
          <button className="btn btn-sm" onClick={() => navigate("/messages")}>View messages</button>
        </div>
      )}
    </div>
  );
}

// ---------------- My Health ----------------
export function PortalHealth() {
  const [me, setMe] = useState(null);
  const [rx, setRx] = useState([]);
  useEffect(() => {
    (async () => {
      try { setMe(await api.portalMe()); setRx(await api.portalPrescriptions()); } catch { /* */ }
    })();
  }, []);
  if (!me) return <p className="muted">Loading…</p>;

  return (
    <div>
      <h1 className="portal-h1">My Health</h1>
      <div className="pcard">
        <h3>About me</h3>
        <p><span className="mono">{me.mrn}</span> · Born {dt(me.dob)} · {me.sex}</p>
        {me.insurance?.[0] && <p className="muted">Insurance: {me.insurance[0].payerName} ({me.insurance[0].planType})</p>}
      </div>
      <div className="pcard">
        <h3>Allergies</h3>
        {me.allergies?.length ? me.allergies.map((a) => <span key={a.id} className="badge st-noshow">⚠ {a.substance} — {a.reaction}</span>) : <p className="muted">No known allergies.</p>}
      </div>
      <div className="pcard">
        <h3>Current medications</h3>
        {rx.length === 0 && me.medications?.length === 0 && <p className="muted">No medications on file.</p>}
        {rx.map((r) => <div key={r.id} className="pcard-row"><div>💊 <strong>{r.drugName}</strong> {r.dose} <div className="muted">{r.frequency} · {r.refills} refills</div></div></div>)}
        {me.medications?.map((m) => <div key={m.id} className="pcard-row"><div>💊 <strong>{m.name}</strong> {m.dose} <div className="muted">{m.frequency}</div></div></div>)}
      </div>
    </div>
  );
}

// ---------------- Results ----------------
export function PortalResults() {
  const [results, setResults] = useState([]);
  useEffect(() => { (async () => { try { setResults(await api.portalResults()); } catch { /* */ } })(); }, []);
  return (
    <div>
      <h1 className="portal-h1">Test & Imaging Results</h1>
      {results.length === 0 && <p className="muted">No results available yet.</p>}
      {results.map((o) => (
        <div key={o.id} className="pcard">
          <div className="pcard-row">
            <div><strong>{o.name}</strong> <span className="badge st-scheduled">{o.type}</span></div>
            <span className="muted">{dt(o.createdAt)}</span>
          </div>
          <p className="result-body">{o.resultText}</p>
          <p className="muted small">Ordered by {o.encounter?.appointment?.provider?.fullName || "your provider"}</p>
        </div>
      ))}
    </div>
  );
}

// ---------------- Visits / After Visit Summary ----------------
export function PortalVisits() {
  const [visits, setVisits] = useState([]);
  const [open, setOpen] = useState(null);
  useEffect(() => { (async () => { try { setVisits(await api.portalVisits()); } catch { /* */ } })(); }, []);

  return (
    <div>
      <h1 className="portal-h1">Visit History</h1>
      {visits.length === 0 && <p className="muted">No completed visits yet.</p>}
      {visits.map((v) => (
        <div key={v.id} className="pcard">
          <div className="pcard-row">
            <div><strong>{v.appointment?.reason || "Office Visit"}</strong>
              <div className="muted">{dt(v.checkInAt)} · {v.appointment?.provider?.fullName} · {v.appointment?.department?.name}</div>
            </div>
            <button className="btn btn-sm" onClick={() => setOpen(open === v.id ? null : v.id)}>{open === v.id ? "Hide" : "After Visit Summary"}</button>
          </div>
          {open === v.id && <AVS visit={v} />}
        </div>
      ))}
    </div>
  );
}

function AVS({ visit }) {
  const note = visit.notes?.[0];
  const vit = visit.vitals?.[0];
  return (
    <div className="avs">
      {vit && <p><b>Vitals:</b> BP {vit.systolic}/{vit.diastolic}, HR {vit.heartRate}, Temp {vit.temperatureF}°F</p>}
      {visit.diagnoses?.length > 0 && (
        <p><b>Diagnoses:</b> {visit.diagnoses.map((d) => `${d.description} (${d.icd10Code})`).join(", ")}</p>
      )}
      {note?.plan && <p><b>Care plan:</b> {note.plan}</p>}
      {visit.orders?.length > 0 && (
        <div><b>Tests ordered:</b>
          <ul>{visit.orders.map((o) => <li key={o.id}>{o.name}{o.resultText ? ` — ${o.resultText}` : ""}</li>)}</ul>
        </div>
      )}
      {visit.prescriptions?.length > 0 && (
        <div><b>Prescriptions:</b>
          <ul>{visit.prescriptions.map((r) => <li key={r.id}>{r.drugName} {r.dose} — {r.frequency}, {r.refills} refills</li>)}</ul>
        </div>
      )}
    </div>
  );
}

// ---------------- Messages ----------------
export function PortalMessages() {
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  async function load() { try { setMsgs(await api.portalMessages()); } catch { /* */ } }
  useEffect(() => { load(); }, []);
  async function send() {
    if (!text.trim()) return;
    setBusy(true);
    try { await api.portalSendMessage(text); setText(""); await load(); } finally { setBusy(false); }
  }
  return (
    <div>
      <h1 className="portal-h1">Secure Messages</h1>
      <div className="pcard">
        <div className="thread">
          {msgs.length === 0 && <p className="muted">No messages yet. Send your care team a note below.</p>}
          {msgs.map((m) => (
            <div key={m.id} className={`bubble ${m.sender === "Patient" ? "mine" : "them"}`}>
              <div className="bubble-who">{m.sender === "Patient" ? "You" : "Care Team"}</div>
              {m.body}
              <div className="bubble-time">{dtt(m.createdAt)}</div>
            </div>
          ))}
        </div>
        <div className="composer">
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a message to your care team…" onKeyDown={(e) => e.key === "Enter" && send()} />
          <button className="btn btn-primary" onClick={send} disabled={busy}>Send</button>
        </div>
      </div>
    </div>
  );
}

// ---------------- Billing ----------------
export function PortalBilling() {
  const [data, setData] = useState(null);
  useEffect(() => { (async () => { try { setData(await api.portalBilling()); } catch { /* */ } })(); }, []);
  if (!data) return <p className="muted">Loading…</p>;
  return (
    <div>
      <h1 className="portal-h1">Billing — PatientWallet</h1>
      <div className="portal-tiles">
        <div className="ptile"><div className="ptile-num">${data.balance.toFixed(2)}</div><div className="ptile-label">Current balance</div></div>
        <div className="ptile"><div className="ptile-num">${data.totalPaid.toFixed(2)}</div><div className="ptile-label">Total paid</div></div>
      </div>
      <div className="pcard">
        <h3>Payment history</h3>
        {data.payments.length === 0 && <p className="muted">No payments on record.</p>}
        {data.payments.map((p) => (
          <div key={p.id} className="pcard-row">
            <div>{p.type} <span className="muted">· {p.method}</span></div>
            <div><strong>${p.amount.toFixed(2)}</strong> <span className="badge st-completed">{p.status}</span> <span className="muted small">{dt(p.createdAt)}</span></div>
          </div>
        ))}
        {data.balance === 0 && <p className="flash" style={{ marginTop: 12 }}>You have no outstanding balance. 🎉</p>}
      </div>
    </div>
  );
}
