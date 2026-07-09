import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./auth.jsx";
import Layout from "./components/Layout.jsx";
import PortalLayout from "./components/PortalLayout.jsx";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Patients from "./pages/Patients.jsx";
import Schedule from "./pages/Schedule.jsx";
import ClinicalQueue from "./pages/ClinicalQueue.jsx";
import Encounter from "./pages/Encounter.jsx";
import { PortalHome, PortalHealth, PortalResults, PortalVisits, PortalMessages, PortalBilling } from "./pages/portal/PortalPages.jsx";

function StaffRoutes() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/patients" element={<Patients />} />
        <Route path="/schedule" element={<Schedule />} />
        <Route path="/clinical" element={<ClinicalQueue />} />
        <Route path="/clinical/:id" element={<Encounter />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

function PortalRoutes() {
  return (
    <PortalLayout>
      <Routes>
        <Route path="/" element={<PortalHome />} />
        <Route path="/health" element={<PortalHealth />} />
        <Route path="/results" element={<PortalResults />} />
        <Route path="/visits" element={<PortalVisits />} />
        <Route path="/messages" element={<PortalMessages />} />
        <Route path="/billing" element={<PortalBilling />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </PortalLayout>
  );
}

export default function App() {
  const { user } = useAuth();
  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }
  return user.role === "patient" ? <PortalRoutes /> : <StaffRoutes />;
}
