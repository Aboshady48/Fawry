const express = require("express");
const authIndexRouter = express.Router();
const registerController = require("../controllers/register.controller");

authIndexRouter.post("/register", registerController.register);

module.exports = authIndexRouter;
