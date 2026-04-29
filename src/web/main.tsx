import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ConfigProvider, ThemeProvider } from "@lobehub/ui";
import { motion } from "motion/react";
import { Router } from "./app/Router";
import { I18nProvider } from "./i18n";
import "./styles/global.css";

const container = document.getElementById("root");
if (!container) throw new Error("root element missing");
createRoot(container).render(
  <React.StrictMode>
    <ConfigProvider motion={motion}>
      <ThemeProvider>
        <I18nProvider>
          <BrowserRouter>
            <Router />
          </BrowserRouter>
        </I18nProvider>
      </ThemeProvider>
    </ConfigProvider>
  </React.StrictMode>,
);
