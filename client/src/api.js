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
};

// Local calendar date (YYYY-MM-DD) — NOT UTC, so "today" matches the server's local-time day bounds.
export const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
