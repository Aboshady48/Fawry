import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App";

import {
  UserProvider,
} from "./context/UserContext";

import {
  WalletProvider,
} from "./context/WalletContext";

import './styles/index.css'

ReactDOM.createRoot(
  document.getElementById(
    "root"
  )
).render(
  <React.StrictMode>
    <UserProvider>
      <WalletProvider>
        <App />
      </WalletProvider>
    </UserProvider>
  </React.StrictMode>
);