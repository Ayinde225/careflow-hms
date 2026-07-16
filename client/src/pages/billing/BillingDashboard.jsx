import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { api } from "../../api.js";

const usd = (n) => "$" + Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function BillingDashboard() {
  const [a, setA] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try { setA(await api.billingAnalytics()); } catch (e) { setErr(e.message); }
    })();
  }, []);

  if (err) return <div className="alert">{err}</div>;
  if (!a) return <p className="muted">Loading revenue data…</p>;

  return (
    <div>
      <div className="page-head">
        <h1>Revenue cycle</h1>
        <BillingTabs />
      </div>

      <div className="kpi-row">
        <div className="kpi"><div className="kpi-num">{usd(a.grossCharges)}</div><div className="kpi-label">Gross charges</div></div>
        <div className="kpi"><div className="kpi-num neg">−{usd(a.contractualAdjustments)}</div><div className="kpi-label">Contractual adjustments</div></div>
        <div className="kpi"><div className="kpi-num pos">{usd(a.netRevenue)}</div><div className="kpi-label">Net collected</div></div>
        <div className="kpi"><div className="kpi-num warn">{usd(a.outstandingAR)}</div><div className="kpi-label">Outstanding A/R</div></div>
      </div>

      <div className="kpi-row">
        <div className="kpi"><div className="kpi-num">{usd(a.insuranceCollected)}</div><div className="kpi-label">Insurance collected</div></div>
        <div className="kpi"><div className="kpi-num">{usd(a.patientCollected)}</div><div className="kpi-label">Patient collected</div></div>
        <div className="kpi"><div className={`kpi-num ${a.denialRate > 10 ? "neg" : "pos"}`}>{a.denialRate}%</div><div className="kpi-label">Denial rate ({a.claimsDenied}/{a.claimsSubmitted} claims)</div></div>
        <div className="kpi"><div className="kpi-num">{a.invoiceCount}</div><div className="kpi-label">Invoices</div></div>
      </div>

      <RevenueBridge a={a} />

      <div className="chart-grid">
        <BarCard title="Charges by department" rows={a.chargesByDepartment} />
        <BarCard title="Payer mix (billed)" rows={a.payerMix} />
      </div>
    </div>
  );
}

export function BillingTabs() {
  return (
    <div className="tabs">
      <NavLink to="/billing" end>Dashboard</NavLink>
      <NavLink to="/billing/work">Claims workspace</NavLink>
    </div>
  );
}

// Gross charges reconcile exactly:
//   gross = contractual adjustments + insurance collected + patient collected + outstanding A/R
function RevenueBridge({ a }) {
  const segs = [
    { label: "Contractual adj.", value: a.contractualAdjustments, cls: "seg-adj" },
    { label: "Insurance collected", value: a.insuranceCollected, cls: "seg-ins" },
    { label: "Patient collected", value: a.patientCollected, cls: "seg-pat" },
    { label: "Outstanding A/R", value: a.outstandingAR, cls: "seg-ar" },
  ].filter((s) => s.value > 0);
  const total = segs.reduce((s, x) => s + x.value, 0) || 1;
  const reconciles = Math.abs(total - a.grossCharges) < 0.01;

  return (
    <div className="card">
      <div className="card-head">Where the gross charges went</div>
      <div className="pad">
        <div className="bridge">
          {segs.map((s) => (
            <div key={s.label} className={`bridge-seg ${s.cls}`} style={{ width: `${(s.value / total) * 100}%` }} title={`${s.label}: ${usd(s.value)}`} />
          ))}
        </div>
        <div className="bridge-legend">
          {segs.map((s) => (
            <span key={s.label}>
              <i className={`dot ${s.cls}`} />{s.label} <b>{usd(s.value)}</b>
              <em>{((s.value / total) * 100).toFixed(1)}%</em>
            </span>
          ))}
        </div>
        <p className="muted small" style={{ marginTop: 10 }}>
          {reconciles
            ? `✓ Reconciles to gross charges of ${usd(a.grossCharges)}.`
            : `⚠ Does not reconcile to gross charges (${usd(a.grossCharges)}).`}
        </p>
      </div>
    </div>
  );
}

function BarCard({ title, rows }) {
  const max = Math.max(...rows.map((r) => r.amount), 1);
  return (
    <div className="card">
      <div className="card-head">{title}</div>
      <div className="pad">
        {rows.length === 0 && <p className="muted">No data yet.</p>}
        {rows.map((r) => (
          <div key={r.name} className="hbar-row">
            <div className="hbar-label">{r.name}</div>
            <div className="hbar-track">
              <div className="hbar-fill" style={{ width: `${(r.amount / max) * 100}%` }} />
            </div>
            <div className="hbar-val">{usd(r.amount)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
