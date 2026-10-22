import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import AdminDashboard from "./AdminDashboard";
import "./styles.css";

const Root = window.location.pathname.startsWith("/admin") ? AdminDashboard : App;

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
