const express = require("express");
const walletRouter = express.Router();
const authMiddleware      = require("../../middleware/authMiddleware.middleware");
const getBalanceController = require("../controllers/getBalance.controller");
const toppupController     = require("../controllers/topup.controller");


walletRouter.get("/balance", authMiddleware, getBalanceController.getBalance);

walletRouter.post("/topup", authMiddleware, toppupController.topup);

module.exports = walletRouter;