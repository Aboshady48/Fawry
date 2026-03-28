const express = require("express");
const walletRouter = express.Router();
const authMiddleware      = require("../../middleware/authMiddleware.middleware");
const getBalanceController = require("../controllers/getBalance.controller");
const toppupController     = require("../controllers/topup.controller");
const withdrawController  = require("../controllers/withdraw.controller");
const getTransactions     = require("../controllers/getTransactions.controller");
const getStatement        = require("../controllers/getStatement.controller");


walletRouter.get("/balance", authMiddleware, getBalanceController.getBalance);

walletRouter.post("/topup", authMiddleware, toppupController.topup);

walletRouter.post("/withdraw", authMiddleware, withdrawController.withdraw);

walletRouter.get("/transactions", authMiddleware, getTransactions.getTransactions);

walletRouter.get("/statement", authMiddleware, getStatement.getStatement);

module.exports = walletRouter;