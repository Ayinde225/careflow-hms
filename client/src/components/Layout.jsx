import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../auth.jsx";

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">✚</span> CareFlow
          <div className="brand-sub">Reception</div>
        </div>
        <nav>
          <NavLink to="/" end>🗓️ Dashboard</NavLink>
          <NavLink to="/patients">👤 Patients</NavLink>
          <NavLink to="/schedule">➕ Schedule</NavLink>
          <NavLink to="/clinical">🩺 Clinical</NavLink>
          <NavLink to="/billing">💵 Billing</NavLink>
        </nav>
        <div className="sidebar-foot">
          <div className="who">
            <div className="who-name">{user?.fullName}</div>
            <div className="who-role">{user?.role}</div>
          </div>
          <button className="btn btn-ghost" onClick={handleLogout}>Sign out</button>
        </div>
      </aside>
      <main className="content">{children}</main>
    </div>
  );
}
