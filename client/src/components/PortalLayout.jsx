import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../auth.jsx";

export default function PortalLayout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  function handleLogout() { logout(); navigate("/login"); }

  return (
    <div className="portal">
      <header className="portal-top">
        <div className="portal-brand"><span className="brand-mark">✚</span> CareFlow <span className="portal-tag">Patient Portal</span></div>
        <nav className="portal-nav">
          <NavLink to="/" end>Home</NavLink>
          <NavLink to="/health">My Health</NavLink>
          <NavLink to="/results">Results</NavLink>
          <NavLink to="/visits">Visits</NavLink>
          <NavLink to="/messages">Messages</NavLink>
          <NavLink to="/billing">Billing</NavLink>
        </nav>
        <div className="portal-user">
          <span>{user?.fullName}</span>
          <button className="btn btn-ghost btn-sm" onClick={handleLogout}>Sign out</button>
        </div>
      </header>
      <main className="portal-main">{children}</main>
    </div>
  );
}
