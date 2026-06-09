import api from "./axios";

export const login = (data) =>
  api.post("/auth/login", data);

export const register = (data) =>
  api.post("/auth/register", data);

export const verifyOtp = (data) =>
  api.post("/auth/verify-otp", data);

export const forgotPassword = (data) =>
  api.post("/auth/forgot-password", data);

export const resetPassword = (data) =>
  api.post("/auth/reset-password", data);

export const setPin = (data) =>
  api.post("/auth/set-pin", data);

export const changePin = (data) =>
  api.post("/auth/change-pin", data);

export const refreshToken = (refreshToken) =>
  api.post("/auth/refresh", {
    refreshToken,
  });

export const logout = (refreshToken) =>
  api.post("/auth/logout", {
    refreshToken,
  });