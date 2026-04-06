const express = require("express");
const agentRouter = express.Router();
const authMiddleware                    = require("../../middleware/authMiddleware.middleware");
const isAgent                           = require("../../middleware/isAgent.middleware");
const cashinController                  = require("../controllers/cashin.controller");
const cashoutController                 = require("../controllers/cashout.controller");
const generateWithdrawalCodeController  = require("../controllers/generateWithdrawalCode.controller");
const getFloatController                = require("../controllers/getFloat.controller");
const getAgentTransactionsController    = require("../controllers/getAgentTransactions.controller");

agentRouter.post("/withdrawal-code",  authMiddleware,         generateWithdrawalCodeController.generateWithdrawalCode);
agentRouter.post("/cashin",           authMiddleware, isAgent, cashinController.cashin);
agentRouter.post("/cashout",          authMiddleware, isAgent, cashoutController.cashout);
agentRouter.get("/float",             authMiddleware, isAgent, getFloatController.getFloat);
agentRouter.get("/transactions",      authMiddleware, isAgent, getAgentTransactionsController.getAgentTransactions);

module.exports = agentRouter;