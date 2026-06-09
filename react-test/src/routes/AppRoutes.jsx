import { Routes, Route } from "react-router-dom";

import Register from "../pages/Register";
import Login from "../pages/Login";
import VerifyOtp from "../pages/VerifyOtp";
import ForgotPassword from "../pages/ForgotPassword";
import ResetPassword from "../pages/ResetPassword";

import SetPin from "../pages/SetPin";
import ChangePin from "../pages/ChangePin";

import Profile from "../pages/Profile";
import Wallet from "../pages/Wallet";
import Transactions from "../pages/Transactions";
import Statement from "../pages/Statement";

import Dashboard from "../test/Dashboard";

import ProtectedRoute from "./ProtectedRoute";

const AppRoutes = () => {
  return (
    <Routes>
      {/* Public Routes */}

      <Route
        path="/"
        element={<Register />}
      />

      <Route
        path="/login"
        element={<Login />}
      />

      <Route
        path="/verify-otp"
        element={<VerifyOtp />}
      />

      <Route
        path="/forgot-password"
        element={<ForgotPassword />}
      />

      <Route
        path="/reset-password"
        element={<ResetPassword />}
      />

      {/* Protected Routes */}

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        }
      />

      <Route
        path="/wallet"
        element={
          <ProtectedRoute>
            <Wallet />
          </ProtectedRoute>
        }
      />

      <Route
        path="/transactions"
        element={
          <ProtectedRoute>
            <Transactions />
          </ProtectedRoute>
        }
      />

      <Route
        path="/statement"
        element={
          <ProtectedRoute>
            <Statement />
          </ProtectedRoute>
        }
      />

      <Route
        path="/set-pin"
        element={
          <ProtectedRoute>
            <SetPin />
          </ProtectedRoute>
        }
      />

      <Route
        path="/change-pin"
        element={
          <ProtectedRoute>
            <ChangePin />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
};

export default AppRoutes;