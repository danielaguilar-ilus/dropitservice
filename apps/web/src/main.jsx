import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import App from "./App";
import PublicQuotePage from "./pages/PublicQuotePage";
import PrivacyPage from "./pages/PrivacyPage";
import ConfirmQuotePage from "./pages/ConfirmQuotePage";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        {/* Raíz = cotizador público (lo que se comparte con clientes) */}
        <Route path="/" element={<PublicQuotePage />} />
        <Route path="/cotizar" element={<PublicQuotePage />} />
        <Route path="/confirmar" element={<ConfirmQuotePage />} />
        <Route path="/privacidad" element={<PrivacyPage />} />
        {/* Panel de operadores (login + dashboard) */}
        <Route path="/panel/*" element={<App />} />
        <Route path="/*" element={<App />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
