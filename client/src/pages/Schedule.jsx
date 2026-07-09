import { useEffect, useState } from "react";
import { api, todayStr } from "../api.js";

export default function Schedule() {
  const [patients, setPatients] = useState([]);
  const [providers, setProviders] = useState([]);
  const [patientId, setPatientId] = useState("");
  const [providerId, setProviderId] = useState("");
  const [date, setDate] = useState(todayStr());
  const [slots, setSlots] = useState([]);
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");
  const [flash, setFlash] = useState("");

  useEffect(() => {
    (async () => {
      try {
        setPatients(await api.patients(""));
        setProviders(await api.providers());
      } catch (e) { setErr(e.message); }
    })();
  }, []);

  useEffect(() => {
    if (!providerId || !date) { setSlots([]); return; }
    (async () => {
      try { setSlots(await api.slots(providerId, date)); } catch (e) { setErr(e.message); }
    })();
  }, [providerId, date]);

  async function book(slot) {
    setErr(""); setFlash("");
    if (!patientId) { setErr("Select a patient first."); return; }
    try {
      const appt = await api.book({ patientId, providerId, startAt: slot.start, minutes: slot.minutes, reason });
      setFlash(`Booked ${appt.patient.firstName} ${appt.patient.lastName} at ${new Date(slot.start).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`);
      setSlots(await api.slots(providerId, date));
    } catch (e) { setErr(e.message); }
  }

  return (
    <div>
      <div className="page-head"><h1>Schedule an appointment</h1></div>
      {err && <div className="alert">{err}</div>}
      {flash && <div className="flash">{flash}</div>}

      <div className="card">
        <div className="grid2">
          <label>Patient
            <select value={patientId} onChange={(e) => setPatientId(e.target.value)}>
              <option value="">Select patient…</option>
              {patients.map((p) => <option key={p.id} value={p.id}>{p.firstName} {p.lastName} — {p.mrn}</option>)}
            </select>
          </label>
          <label>Provider
            <select value={providerId} onChange={(e) => setProviderId(e.target.value)}>
              <option value="">Select provider…</option>
              {providers.map((p) => <option key={p.id} value={p.id}>{p.fullName} — {p.specialty}</option>)}
            </select>
          </label>
          <label>Date<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
          <label>Reason<input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Annual physical" /></label>
        </div>
      </div>

      <div className="card">
        <div className="card-head">Available slots {providerId ? `· ${slots.length} open` : ""}</div>
        {!providerId && <p className="muted center">Pick a provider and date to see open times.</p>}
        {providerId && slots.length === 0 && <p className="muted center">No open slots for this day (providers work Mon–Fri).</p>}
        <div className="slot-grid">
          {slots.map((s) => (
            <button key={s.start} className="slot" onClick={() => book(s)}>
              {new Date(s.start).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
