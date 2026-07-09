import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api.js";

function age(dob) {
  const d = new Date(dob);
  return Math.floor((Date.now() - d.getTime()) / (365.25 * 864e5));
}

export default function ClinicalQueue() {
  const [queue, setQueue] = useState([]);
  const [err, setErr] = useState("");
  const navigate = useNavigate();

  async function load() {
    try { setQueue(await api.clinicalQueue()); } catch (e) { setErr(e.message); }
  }
  useEffect(() => { load(); }, []);

  return (
    <div>
      <div className="page-head">
        <h1>Clinical queue</h1>
        <span className="muted">Checked-in patients waiting to be seen</span>
      </div>
      {err && <div className="alert">{err}</div>}

      <div className="card">
        <div className="card-head">Waiting room ({queue.length})</div>
        <table className="table">
          <thead>
            <tr><th>Checked in</th><th>Patient</th><th>Age</th><th>Provider</th><th>Reason</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {queue.length === 0 && <tr><td colSpan="7" className="muted center">No patients checked in yet. Check patients in from the Dashboard.</td></tr>}
            {queue.map((e) => (
              <tr key={e.id}>
                <td>{new Date(e.checkInAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</td>
                <td><strong>{e.patient.firstName} {e.patient.lastName}</strong> <span className="mono">· {e.patient.mrn}</span></td>
                <td>{age(e.patient.dob)}</td>
                <td>{e.appointment?.provider?.fullName || "—"}</td>
                <td className="muted">{e.appointment?.reason}</td>
                <td><span className="badge st-checkedin">{e.diagnoses?.length ? "In progress" : "Waiting"}</span></td>
                <td className="row-actions">
                  <button className="btn btn-sm btn-primary" onClick={() => navigate(`/clinical/${e.id}`)}>Open chart</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
