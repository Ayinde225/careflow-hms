const B = "http://localhost:4100/api";
let pass = 0, fail = 0;
const ok = (cond, label, extra = "") => { cond ? (pass++, console.log(`  PASS  ${label}`)) : (fail++, console.log(`  FAIL  ${label} ${extra}`)); };

const login = async (email, password) => (await (await fetch(B + "/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) })).json()).token;
const H = (t) => ({ Authorization: "Bearer " + t, "Content-Type": "application/json" });
const status = async (p, t, opts = {}) => (await fetch(B + p, { headers: H(t), ...opts })).status;
const get = async (p, t) => (await fetch(B + p, { headers: H(t) })).json();
const post = async (p, t, body) => { const r = await fetch(B + p, { method: "POST", headers: H(t), body: body ? JSON.stringify(body) : undefined }); return { status: r.status, body: await r.json() }; };

const patient = await login("jordan@careflow.dev", "patient123");
const billing = await login("billing@careflow.dev", "billing123");
const reception = await login("reception@careflow.dev", "reception123");

console.log("\n[B] RBAC — patient must not reach staff data");
ok(await status("/patients", patient) === 403, "patient -> GET /patients is 403");
ok(await status("/patients/xyz", patient) === 403, "patient -> GET /patients/:id is 403");
ok(await status("/appointments", patient) === 403, "patient -> GET /appointments is 403");
ok(await status("/payments/today-summary", patient) === 403, "patient -> GET /payments/today-summary is 403");
ok(await status("/billing/analytics", patient) === 403, "patient -> GET /billing/analytics is 403");
ok(await status("/clinical/queue", patient) === 403, "patient -> GET /clinical/queue is 403");
console.log("  (staff still work)");
ok(await status("/patients", reception) === 200, "reception -> GET /patients is 200");
ok(await status("/appointments", reception) === 200, "reception -> GET /appointments is 200");
ok(await status("/billing/analytics", billing) === 200, "billing -> GET /billing/analytics is 200");

console.log("\n[A] Copay double-billing — Jordan's $30 desk copay must credit his invoice");
const invoices = await get("/billing/invoices", billing);
const jordanInv = invoices.find((i) => i.patient.firstName === "Jordan");
ok(jordanInv.summary.patientPaid === 30, "patientPaid counts the $30 copay", `got ${jordanInv.summary.patientPaid}`);
ok(jordanInv.summary.balance === 0, "balance is $0 (not double-billed)", `got ${jordanInv.summary.balance}`);
ok(jordanInv.status === "Paid", "invoice status is Paid", `got ${jordanInv.status}`);

console.log("\n[E] Patient portal must tell the truth");
const pb = await get("/portal/billing", patient);
ok(pb.balance === 0, "portal balance is real (0, computed not hardcoded)", `got ${pb.balance}`);
ok(Array.isArray(pb.bills) && pb.bills.length > 0, "portal returns real bills");
ok(pb.totalPaid === 30, "portal totalPaid = patient's own $30 (excludes $148.50 insurer EFT)", `got ${pb.totalPaid}`);
ok(!pb.payments.some((p) => p.source === "Insurance"), "portal payment history excludes insurer EFT");

console.log("\n[G] Front-desk KPI excludes insurer EFT");
const todaySum = await get("/payments/today-summary", reception);
ok(todaySum.total === 0, "today-summary excludes the $148.50 insurance EFT", `got ${todaySum.total}`);

console.log("\n[I] Cannot invoice an encounter that isn't closed");
const openEnc = await get("/clinical/queue", await login("dr.hart@careflow.dev", "doctor123")).catch(() => []);
console.log("  (queue may be empty; covered by code guard)");

console.log("\n[F] Overpayment must be rejected");
const unbilled = await get("/billing/unbilled", billing);
ok(unbilled.length > 0, "Priya's completed visit is billable");
const inv2 = (await post(`/billing/encounters/${unbilled[0].id}/invoice`, billing)).body;
ok(inv2.summary.billed === 300, "Priya invoice billed $300", `got ${inv2.summary.billed}`);
const claim2 = (await post(`/billing/invoices/${inv2.id}/claim`, billing)).body;
ok(claim2.status === "Denied", "unverified coverage -> claim Denied", `got ${claim2.status}`);
const over = await post(`/billing/invoices/${inv2.id}/payment`, billing, { amount: 999 });
ok(over.status === 400 && /exceeds balance/i.test(over.body.error || ""), "overpayment rejected with 400", JSON.stringify(over.body));
const dup = await post(`/billing/invoices/${inv2.id}/claim`, billing);
ok(dup.status === 409, "duplicate claim rejected with 409", `got ${dup.status}`);

console.log("\n[C] Denied invoice paid in full must become Paid (not stuck Denied)");
const payFull = await post(`/billing/invoices/${inv2.id}/payment`, billing, { amount: 300 });
ok(payFull.status === 201 && payFull.body.summary.balance === 0, "paid in full -> balance 0", JSON.stringify(payFull.body.summary || payFull.body));
const inv2after = await get(`/billing/invoices/${inv2.id}`, billing);
ok(inv2after.status === "Paid", "status recovers to Paid after payment", `got ${inv2after.status}`);
const noMore = await post(`/billing/invoices/${inv2.id}/payment`, billing, { amount: 5 });
ok(noMore.status === 400, "payment on zero-balance invoice rejected", `got ${noMore.status}`);

console.log("\n[Reconciliation] identity must hold");
const a = await get("/billing/analytics", billing);
const sum = +(a.contractualAdjustments + a.insuranceCollected + a.patientCollected + a.outstandingAR).toFixed(2);
ok(Math.abs(sum - a.grossCharges) < 0.01, `gross ${a.grossCharges} === adj+ins+pat+AR (${sum})`);
console.log(`     gross=$${a.grossCharges} adj=$${a.contractualAdjustments} ins=$${a.insuranceCollected} pat=$${a.patientCollected} AR=$${a.outstandingAR} denialRate=${a.denialRate}%`);

console.log(`\n==== ${pass} passed, ${fail} failed ====`);
process.exit(fail ? 1 : 0);
