import { createContext, useContext, useState } from "react";
import { api } from "./api.js";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem("careflow_user");
    return raw ? JSON.parse(raw) : null;
  });

  async function login(email, password) {
    const { token, user } = await api.login(email, password);
    localStorage.setItem("careflow_token", token);
    localStorage.setItem("careflow_user", JSON.stringify(user));
    setUser(user);
    return user;
  }

  function logout() {
    localStorage.removeItem("careflow_token");
    localStorage.removeItem("careflow_user");
    setUser(null);
  }

  return <AuthCtx.Provider value={{ user, login, logout }}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
