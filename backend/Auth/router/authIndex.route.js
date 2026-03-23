const express = require("express");
const authIndexRouter = express.Router();
const registerController = require("../controllers/register.controller");
const loginController = require("../controllers/login.controller");
const verfyOtpController = require("../controllers/verify-otp.controller");
const refreshController = require("../controllers/refresh.controller");
const logoutController = require("../controllers/logout.controller");
const forgotPasswordController = require("../controllers/forgot-password.controller");


authIndexRouter.post("/register", registerController.register);
authIndexRouter.post("/login", loginController.loginController);
authIndexRouter.post("/verify-otp", verfyOtpController.verifyOtp);
authIndexRouter.post("/refresh", refreshController.refreshController);
authIndexRouter.post("/logout", logoutController.logoutController);
authIndexRouter.post("/forgot-password", forgotPasswordController.forgotPassword);

module.exports = authIndexRouter;
