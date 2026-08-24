import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import CloudSyncGate from "./CloudSyncGate.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <CloudSyncGate>
      <App />
    </CloudSyncGate>
  </React.StrictMode>
);
