const express = require("express");
const authIndexRouter = express.Router();
const registerController = require("../controllers/register.controller");
const loginController = require("../controllers/login.controller");
const verfyOtpController = require("../controllers/verify-otp.controller");
const refreshController = require("../controllers/refresh.controller");

authIndexRouter.post("/register", registerController.register);
authIndexRouter.post("/login", loginController.loginController);
authIndexRouter.post("/verify-otp", verfyOtpController.verifyOtp);
authIndexRouter.post("/refresh", refreshController.refreshController);

module.exports = authIndexRouter;
