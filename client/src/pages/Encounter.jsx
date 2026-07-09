import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../api.js";
import { ICD10, LABS, IMAGING, DRUGS } from "../clinicalRefs.js";

function age(dob) {
  return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 864e5));
}

export default function Encounter() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [enc, setEnc] = useState(null);
  const [err, setErr] = useState("");
  const [flash, setFlash] = useState("");

  async function load() {
    try { setEnc(await api.encounter(id)); } catch (e) { setErr(e.message); }
  }
  useEffect(() => { load(); }, [id]);

  async function run(fn, msg) {
    setErr(""); setFlash("");
    try { await fn(); await load(); if (msg) setFlash(msg); }
    catch (e) { setErr(e.message); }
  }

  if (!enc) return <div className="muted">{err || "Loading chart…"}</div>;

  const p = enc.patient;
  const latestVitals = enc.vitals?.[0];
  const closed = enc.status === "Closed";

  return (
    <div>
      <button className="btn btn-ghost btn-sm" onClick={() => navigate("/clinical")}>← Back to queue</button>

      {/* Patient banner */}
      <div className="banner">
        <div>
          <h1>{p.firstName} {p.lastName}</h1>
          <div className="banner-meta">
            <span className="mono">{p.mrn}</span> · {age(p.dob)}y · {p.sex} ·
            DOB {new Date(p.dob).toLocaleDateString()} ·
            {enc.appointment?.provider?.fullName}
          </div>
        </div>
        <div className="banner-flags">
          {p.allergies?.length
            ? p.allergies.map((a) => <span key={a.id} className="badge st-noshow">⚠ {a.substance}</span>)
            : <span className="badge st-completed">No known allergies</span>}
          {closed && <span className="badge st-completed">Visit completed</span>}
        </div>
      </div>
      {err && <div className="alert">{err}</div>}
      {flash && <div className="flash">{flash}</div>}

      <div className="chart-grid">
        <div>
          <VitalsCard enc={enc} latest={latestVitals} disabled={closed} run={run} />
          <NoteCard enc={enc} disabled={closed} run={run} />
        </div>
        <div>
          <DiagnosesCard enc={enc} disabled={closed} run={run} />
          <OrdersCard enc={enc} disabled={closed} run={run} />
          <RxCard enc={enc} disabled={closed} run={run} />
        </div>
      </div>

      {!closed && (
        <div className="complete-bar">
          <span className="muted">Finished with this patient?</span>
          <button className="btn btn-primary" onClick={() => run(() => api.completeEncounter(id), "Visit completed — After Visit Summary ready.")}>
            ✓ Complete visit
          </button>
        </div>
      )}
    </div>
  );
}

function VitalsCard({ enc, latest, disabled, run }) {
  const [f, setF] = useState({ systolic: "", diastolic: "", heartRate: "", temperatureF: "", respiratoryRate: "", weightKg: "", heightCm: "" });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <div className="card">
      <div className="card-head">Vitals</div>
      <div className="pad">
        {latest && (
          <div className="vital-strip">
            <div><b>{latest.systolic}/{latest.diastolic}</b><span>BP</span></div>
            <div><b>{latest.heartRate}</b><span>HR</span></div>
            <div><b>{latest.temperatureF}°F</b><span>Temp</span></div>
            <div><b>{latest.respiratoryRate}</b><span>RR</span></div>
            <div><b>{latest.weightKg}kg</b><span>Weight</span></div>
          </div>
        )}
        {!disabled && (
          <div className="mini-grid">
            <label>Systolic<input value={f.systolic} onChange={set("systolic")} type="number" /></label>
            <label>Diastolic<input value={f.diastolic} onChange={set("diastolic")} type="number" /></label>
            <label>Heart rate<input value={f.heartRate} onChange={set("heartRate")} type="number" /></label>
            <label>Temp °F<input value={f.temperatureF} onChange={set("temperatureF")} type="number" /></label>
            <label>Resp rate<input value={f.respiratoryRate} onChange={set("respiratoryRate")} type="number" /></label>
            <label>Weight kg<input value={f.weightKg} onChange={set("weightKg")} type="number" /></label>
            <label>Height cm<input value={f.heightCm} onChange={set("heightCm")} type="number" /></label>
            <div className="mini-action">
              <button className="btn btn-sm btn-primary" onClick={() => run(() => api.addVitals(enc.id, f), "Vitals recorded.")}>Save vitals</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function NoteCard({ enc, disabled, run }) {
  const [n, setN] = useState({ subjective: "", objective: "", assessment: "", plan: "" });
  const set = (k) => (e) => setN({ ...n, [k]: e.target.value });
  const saved = enc.notes?.[0];
  return (
    <div className="card">
      <div className="card-head">Clinical note (SOAP)</div>
      <div className="pad">
        {saved && (
          <div className="saved-note">
            {saved.subjective && <p><b>S:</b> {saved.subjective}</p>}
            {saved.objective && <p><b>O:</b> {saved.objective}</p>}
            {saved.assessment && <p><b>A:</b> {saved.assessment}</p>}
            {saved.plan && <p><b>P:</b> {saved.plan}</p>}
          </div>
        )}
        {!disabled && (
          <>
            <label>Subjective<textarea rows="2" value={n.subjective} onChange={set("subjective")} placeholder="Patient's reported symptoms…" /></label>
            <label>Objective<textarea rows="2" value={n.objective} onChange={set("objective")} placeholder="Exam findings…" /></label>
            <label>Assessment<textarea rows="2" value={n.assessment} onChange={set("assessment")} placeholder="Clinical impression…" /></label>
            <label>Plan<textarea rows="2" value={n.plan} onChange={set("plan")} placeholder="Treatment plan…" /></label>
            <button className="btn btn-sm btn-primary" onClick={() => run(() => api.addNote(enc.id, n), "Note saved.")}>Save note</button>
          </>
        )}
      </div>
    </div>
  );
}

function DiagnosesCard({ enc, disabled, run }) {
  const [code, setCode] = useState("");
  const options = ICD10.filter((d) => !enc.diagnoses.some((x) => x.icd10Code === d.code));
  function add() {
    const dx = ICD10.find((d) => d.code === code);
    if (!dx) return;
    run(() => api.addDiagnosis(enc.id, { icd10Code: dx.code, description: dx.description, isPrimary: enc.diagnoses.length === 0 }), "Diagnosis added.");
    setCode("");
  }
  return (
    <div className="card">
      <div className="card-head">Diagnoses (ICD-10)</div>
      <div className="pad">
        {enc.diagnoses.length === 0 && <p className="muted">No diagnoses yet.</p>}
        {enc.diagnoses.map((d) => (
          <div key={d.id} className="list-row">
            <span><span className="mono">{d.icd10Code}</span> {d.description} {d.isPrimary && <span className="badge st-roomed">Primary</span>}</span>
            {!disabled && <button className="linkbtn" onClick={() => run(() => api.removeDiagnosis(d.id))}>remove</button>}
          </div>
        ))}
        {!disabled && (
          <div className="add-row">
            <select value={code} onChange={(e) => setCode(e.target.value)}>
              <option value="">Add diagnosis…</option>
              {options.map((d) => <option key={d.code} value={d.code}>{d.code} — {d.description}</option>)}
            </select>
            <button className="btn btn-sm" onClick={add} disabled={!code}>Add</button>
          </div>
        )}
      </div>
    </div>
  );
}

function OrdersCard({ enc, disabled, run }) {
  const [type, setType] = useState("Lab");
  const [name, setName] = useState("");
  const list = type === "Lab" ? LABS : IMAGING;
  return (
    <div className="card">
      <div className="card-head">Orders — labs & imaging</div>
      <div className="pad">
        {enc.orders.length === 0 && <p className="muted">No orders.</p>}
        {enc.orders.map((o) => (
          <div key={o.id} className="list-row">
            <span><span className="badge st-scheduled">{o.type}</span> {o.name}
              {o.status === "Resulted" && <span className="muted"> · {o.resultText}</span>}
            </span>
            {!disabled && o.status !== "Resulted" && (
              <button className="linkbtn" onClick={() => run(() => api.resultOrder(o.id, {}), "Result received.")}>mark resulted</button>
            )}
            {o.status === "Resulted" && <span className="badge st-completed">Resulted</span>}
          </div>
        ))}
        {!disabled && (
          <div className="add-row">
            <select value={type} onChange={(e) => { setType(e.target.value); setName(""); }}>
              <option>Lab</option><option>Imaging</option>
            </select>
            <select value={name} onChange={(e) => setName(e.target.value)}>
              <option value="">Select {type.toLowerCase()}…</option>
              {list.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
            <button className="btn btn-sm" disabled={!name} onClick={() => { run(() => api.addOrder(enc.id, { type, name }), "Order placed."); setName(""); }}>Order</button>
          </div>
        )}
      </div>
    </div>
  );
}

function RxCard({ enc, disabled, run }) {
  const [f, setF] = useState({ drugName: "", dose: "", frequency: "", quantity: "30", refills: "0", instructions: "" });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  function pick(e) {
    const d = DRUGS.find((x) => x.name === e.target.value);
    if (d) setF({ ...f, drugName: d.name, dose: d.dose, frequency: d.frequency });
  }
  return (
    <div className="card">
      <div className="card-head">Prescriptions (e-Rx)</div>
      <div className="pad">
        {enc.prescriptions.length === 0 && <p className="muted">No prescriptions.</p>}
        {enc.prescriptions.map((r) => (
          <div key={r.id} className="list-row">
            <span>💊 <b>{r.drugName}</b> {r.dose} · {r.frequency} · qty {r.quantity} · {r.refills} refills</span>
          </div>
        ))}
        {!disabled && (
          <>
            <div className="add-row">
              <select onChange={pick} value={f.drugName}>
                <option value="">Pick a medication…</option>
                {DRUGS.map((d) => <option key={d.name} value={d.name}>{d.name} {d.dose}</option>)}
              </select>
            </div>
            <div className="mini-grid">
              <label>Drug<input value={f.drugName} onChange={set("drugName")} /></label>
              <label>Dose<input value={f.dose} onChange={set("dose")} /></label>
              <label>Frequency<input value={f.frequency} onChange={set("frequency")} /></label>
              <label>Quantity<input type="number" value={f.quantity} onChange={set("quantity")} /></label>
              <label>Refills<input type="number" value={f.refills} onChange={set("refills")} /></label>
            </div>
            <button className="btn btn-sm btn-primary" disabled={!f.drugName} onClick={() => { run(() => api.addPrescription(enc.id, f), "Prescription sent."); setF({ drugName: "", dose: "", frequency: "", quantity: "30", refills: "0", instructions: "" }); }}>Prescribe</button>
          </>
        )}
      </div>
    </div>
  );
}
