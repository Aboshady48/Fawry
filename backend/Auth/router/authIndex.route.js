const express = require("express");
const authmiddleware = require("../../middleware/authMiddleware.middleware");

const authIndexRouter = express.Router();
const registerController = require("../controllers/register.controller");
const loginController = require("../controllers/login.controller");
const verfyOtpController = require("../controllers/verify-otp.controller");
const refreshController = require("../controllers/refresh.controller");
const logoutController = require("../controllers/logout.controller");
const forgotPasswordController = require("../controllers/forgot-password.controller");
const resetPasswordController = require("../controllers/reset-password.controller");
const setPinController = require("../controllers/set-pin.controller");
const changePinController = require("../controllers/change-pin.controller");

authIndexRouter.post("/register", registerController.register);
authIndexRouter.post("/login", loginController.loginController);
authIndexRouter.post("/verify-otp", verfyOtpController.verifyOtp);
authIndexRouter.post("/refresh", refreshController.refreshController);
authIndexRouter.post("/logout", logoutController.logoutController);
authIndexRouter.post("/forgot-password", forgotPasswordController.forgotPassword);
authIndexRouter.post("/reset-password", resetPasswordController.resetPassword);

authIndexRouter.use(authmiddleware);
authIndexRouter.post("/set-pin", setPinController.setPin);
authIndexRouter.post("/change-pin", changePinController.changePin);


module.exports = authIndexRouter;
