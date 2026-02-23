import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app/App";
import "./app/globals.css";

// Initialize IndexedDB on app start
import { dbService } from "./services/db.service";
dbService.init().catch(console.error);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
