import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Router } from "./app/Router";
import { I18nProvider } from "./i18n";
import "./styles/global.css";

const container = document.getElementById("root");
if (!container) throw new Error("root element missing");
createRoot(container).render(
  <React.StrictMode>
    <I18nProvider>
      <BrowserRouter>
        <Router />
      </BrowserRouter>
    </I18nProvider>
  </React.StrictMode>,
);
