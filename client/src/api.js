const BASE = import.meta.env.VITE_API_URL || "http://localhost:4100/api";

function token() {
  return localStorage.getItem("careflow_token");
}

async function request(path, { method = "GET", body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) {
    localStorage.removeItem("careflow_token");
    localStorage.removeItem("careflow_user");
    if (!path.startsWith("/auth/login")) window.location.href = "/login";
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  login: (email, password) => request("/auth/login", { method: "POST", body: { email, password } }),
  appointments: (date) => request(`/appointments?date=${date}`),
  book: (body) => request("/appointments", { method: "POST", body }),
  setStatus: (id, status) => request(`/appointments/${id}/status`, { method: "PATCH", body: { status } }),
  checkIn: (id) => request(`/appointments/${id}/check-in`, { method: "POST" }),
  patients: (q = "") => request(`/patients?q=${encodeURIComponent(q)}`),
  patient: (id) => request(`/patients/${id}`),
  createPatient: (body) => request("/patients", { method: "POST", body }),
  verifyInsurance: (id) => request(`/patients/${id}/insurance/verify`, { method: "POST" }),
  departments: () => request("/scheduling/departments"),
  providers: (departmentId) => request(`/scheduling/providers${departmentId ? `?departmentId=${departmentId}` : ""}`),
  slots: (providerId, date) => request(`/scheduling/providers/${providerId}/slots?date=${date}`),
  pay: (body) => request("/payments", { method: "POST", body }),
  paymentSummary: () => request("/payments/today-summary"),

  // --- Phase 2: Clinical ---
  clinicalQueue: () => request("/clinical/queue"),
  encounter: (id) => request(`/clinical/encounters/${id}`),
  addVitals: (id, body) => request(`/clinical/encounters/${id}/vitals`, { method: "POST", body }),
  addNote: (id, body) => request(`/clinical/encounters/${id}/note`, { method: "POST", body }),
  addDiagnosis: (id, body) => request(`/clinical/encounters/${id}/diagnoses`, { method: "POST", body }),
  removeDiagnosis: (id) => request(`/clinical/diagnoses/${id}`, { method: "DELETE" }),
  addOrder: (id, body) => request(`/clinical/encounters/${id}/orders`, { method: "POST", body }),
  resultOrder: (id, body) => request(`/clinical/orders/${id}/result`, { method: "PATCH", body }),
  addPrescription: (id, body) => request(`/clinical/encounters/${id}/prescriptions`, { method: "POST", body }),
  completeEncounter: (id) => request(`/clinical/encounters/${id}/complete`, { method: "POST" }),

  // --- Phase 3: Patient portal (scoped to the logged-in patient) ---
  portalMe: () => request("/portal/me"),
  portalAppointments: () => request("/portal/appointments"),
  portalCancel: (id) => request(`/portal/appointments/${id}/cancel`, { method: "POST" }),
  portalResults: () => request("/portal/results"),
  portalPrescriptions: () => request("/portal/prescriptions"),
  portalVisits: () => request("/portal/visits"),
  portalBilling: () => request("/portal/billing"),
  portalMessages: () => request("/portal/messages"),
  portalSendMessage: (body) => request("/portal/messages", { method: "POST", body: { body } }),

  // --- Phase 5: Billing / revenue cycle (billing + admin) ---
  billingAnalytics: () => request("/billing/analytics"),
  billingUnbilled: () => request("/billing/unbilled"),
  generateInvoice: (encId) => request(`/billing/encounters/${encId}/invoice`, { method: "POST" }),
  billingInvoices: () => request("/billing/invoices"),
  billingInvoice: (id) => request(`/billing/invoices/${id}`),
  submitClaim: (id) => request(`/billing/invoices/${id}/claim`, { method: "POST" }),
  postInvoicePayment: (id, body) => request(`/billing/invoices/${id}/payment`, { method: "POST", body }),
};

// Local calendar date (YYYY-MM-DD) — NOT UTC, so "today" matches the server's local-time day bounds.
export const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
