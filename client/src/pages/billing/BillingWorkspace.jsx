import { useEffect, useState } from "react";
import { api } from "../../api.js";
import { BillingTabs } from "./BillingDashboard.jsx";

const usd = (n) => "$" + Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dt = (iso) => new Date(iso).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });

const STATUS_CLS = {
  Open: "st-scheduled", Claimed: "st-roomed", PartiallyPaid: "st-checkedin",
  Paid: "st-completed", Denied: "st-noshow", Void: "st-cancelled",
};

export default function BillingWorkspace() {
  const [unbilled, setUnbilled] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [open, setOpen] = useState(null);
  const [err, setErr] = useState("");
  const [flash, setFlash] = useState("");

  async function load() {
    try {
      setUnbilled(await api.billingUnbilled());
      setInvoices(await api.billingInvoices());
    } catch (e) { setErr(e.message); }
  }
  useEffect(() => { load(); }, []);

  async function run(fn, msg) {
    setErr(""); setFlash("");
    try { await fn(); await load(); if (msg) setFlash(msg); }
    catch (e) { setErr(e.message); }
  }

  return (
    <div>
      <div className="page-head">
        <h1>Claims workspace</h1>
        <BillingTabs />
      </div>
      {err && <div className="alert">{err}</div>}
      {flash && <div className="flash">{flash}</div>}

      <div className="card">
        <div className="card-head">Ready to bill — completed visits without an invoice ({unbilled.length})</div>
        <table className="table">
          <thead><tr><th>Visit date</th><th>Patient</th><th>Provider</th><th>Services</th><th></th></tr></thead>
          <tbody>
            {unbilled.length === 0 && <tr><td colSpan="5" className="muted center">Nothing to bill — every completed visit has an invoice.</td></tr>}
            {unbilled.map((e) => (
              <tr key={e.id}>
                <td>{dt(e.checkInAt)}</td>
                <td><strong>{e.patient.firstName} {e.patient.lastName}</strong> <span className="mono">· {e.patient.mrn}</span></td>
                <td>{e.appointment?.provider?.fullName}</td>
                <td className="muted">Office visit + {e.orders.length} order{e.orders.length === 1 ? "" : "s"}</td>
                <td className="row-actions">
                  <button className="btn btn-sm btn-primary"
                    onClick={() => run(() => api.generateInvoice(e.id), "Invoice generated from services.")}>
                    Generate invoice
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <div className="card-head">Invoices ({invoices.length})</div>
        <table className="table">
          <thead><tr><th>Invoice</th><th>Patient</th><th>Billed</th><th>Ins. paid</th><th>Balance</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {invoices.length === 0 && <tr><td colSpan="7" className="muted center">No invoices yet.</td></tr>}
            {invoices.map((i) => (
              <FragmentRow key={i.id} inv={i} open={open === i.id} onToggle={() => setOpen(open === i.id ? null : i.id)} run={run} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FragmentRow({ inv, open, onToggle, run }) {
  return (
    <>
      <tr>
        <td className="mono">{inv.number}</td>
        <td><strong>{inv.patient.firstName} {inv.patient.lastName}</strong></td>
        <td>{usd(inv.summary.billed)}</td>
        <td>{usd(inv.summary.insurancePaid)}</td>
        <td><strong className={inv.summary.balance > 0 ? "warn" : "pos"}>{usd(inv.summary.balance)}</strong></td>
        <td><span className={`badge ${STATUS_CLS[inv.status] || "st-scheduled"}`}>{inv.status}</span></td>
        <td className="row-actions">
          <button className="btn btn-sm" onClick={onToggle}>{open ? "Hide" : "Open"}</button>
        </td>
      </tr>
      {open && (
        <tr className="detail-row">
          <td colSpan="7"><InvoiceDetail inv={inv} run={run} /></td>
        </tr>
      )}
    </>
  );
}

function InvoiceDetail({ inv, run }) {
  const [amount, setAmount] = useState(inv.summary.balance > 0 ? inv.summary.balance.toFixed(2) : "");
  const claim = inv.claim;

  return (
    <div className="inv-detail">
      <div className="inv-cols">
        <div>
          <h4>Charges (CPT)</h4>
          <table className="mini-table">
            <tbody>
              {inv.charges.map((c) => (
                <tr key={c.id}>
                  <td className="mono">{c.cptCode}</td>
                  <td>{c.description}</td>
                  <td className="right">{usd(c.amount * c.quantity)}</td>
                </tr>
              ))}
              <tr className="total"><td></td><td><b>Total billed</b></td><td className="right"><b>{usd(inv.summary.billed)}</b></td></tr>
            </tbody>
          </table>
        </div>

        <div>
          <h4>Insurance claim</h4>
          {!claim && (
            <>
              <p className="muted">No claim submitted yet.</p>
              <button className="btn btn-sm btn-primary" onClick={() => run(() => api.submitClaim(inv.id), "Claim submitted and adjudicated.")}>
                Submit claim to payer
              </button>
            </>
          )}
          {claim && (
            <div className="claim-panel">
              <div className="claim-head">
                <span className="mono">{claim.claimNumber}</span>
                <span className={`badge ${claim.status === "Paid" ? "st-completed" : "st-noshow"}`}>{claim.status}</span>
              </div>
              <p className="muted small">Payer: {claim.payerName}</p>
              {claim.status === "Denied" ? (
                <p className="deny">⚠ {claim.denialReason}<br /><span className="muted small">Full balance moves to patient responsibility.</span></p>
              ) : (
                <table className="mini-table">
                  <tbody>
                    <tr><td>Billed</td><td className="right">{usd(claim.billedAmount)}</td></tr>
                    <tr><td>Allowed</td><td className="right">{usd(claim.allowedAmount)}</td></tr>
                    <tr><td>Contractual adj.</td><td className="right neg">−{usd(claim.billedAmount - claim.allowedAmount)}</td></tr>
                    <tr><td>Insurance paid</td><td className="right pos">{usd(claim.insurancePaid)}</td></tr>
                    <tr className="total"><td><b>Patient responsibility</b></td><td className="right"><b>{usd(claim.patientResponsibility)}</b></td></tr>
                  </tbody>
                </table>
              )}
            </div>
          )}

          <h4 style={{ marginTop: 16 }}>Patient payment</h4>
          <p className="muted small">Balance due: <b>{usd(inv.summary.balance)}</b> · paid to date {usd(inv.summary.patientPaid)}</p>
          {inv.summary.balance > 0 ? (
            <div className="add-row">
              <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount" />
              <button className="btn btn-sm btn-primary" disabled={!amount || Number(amount) <= 0}
                onClick={() => run(() => api.postInvoicePayment(inv.id, { amount: Number(amount), method: "Card" }), "Payment posted.")}>
                Post payment
              </button>
            </div>
          ) : <p className="flash">Paid in full 🎉</p>}
        </div>
      </div>
    </div>
  );
}
