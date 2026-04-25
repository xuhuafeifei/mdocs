import React from "react";
import { createRoot } from "react-dom/client";
import { Router } from "./app/Router";
import "./styles/global.css";

const container = document.getElementById("root");
if (!container) throw new Error("root element missing");
createRoot(container).render(
  <React.StrictMode>
    <Router />
  </React.StrictMode>,
);
