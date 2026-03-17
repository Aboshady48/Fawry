const express = require("express");
const authIndexRouter = express.Router();
const registerController = require("../controllers/register.controller");
const loginController = require("../controllers/login.controller");

authIndexRouter.post("/register", registerController.register);
authIndexRouter.post("/login", loginController.loginController);

module.exports = authIndexRouter;
