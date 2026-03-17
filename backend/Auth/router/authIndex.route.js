const express = require("express");
const authIndexRouter = express.Router();
const registerController = require("../controllers/register.controller");
const loginController = require("../controllers/login.controller");
const verfyOtpController = require("../controllers/verify-otp.controller");

authIndexRouter.post("/register", registerController.register);
authIndexRouter.post("/login", loginController.loginController);
authIndexRouter.post("/verify-otp", verfyOtpController.verifyOtp);

module.exports = authIndexRouter;
