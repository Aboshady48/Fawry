const express = require("express");
const merchantRouter = express.Router();
const authMiddleware                    = require("../../middleware/authMiddleware.middleware");
const isMerchant                        = require("../../middleware/isMerchant.middleware");
const registerMerchantController        = require("../controllers/registerMerchant.controller");
const getMerchantMeController           = require("../controllers/getMerchantMe.controller");
const chargeController                  = require("../controllers/charge.controller");
const confirmChargeController           = require("../controllers/confirmCharge.controller");
const getMerchantTransactionsController = require("../controllers/getMerchantTransactions.controller");
const getSettlementsController          = require("../controllers/getSettlements.controller");
const updateWebhookController           = require("../controllers/updateWebhook.controller");

merchantRouter.post("/register",        authMiddleware,             registerMerchantController.registerMerchant);
merchantRouter.get("/me",               authMiddleware, isMerchant, getMerchantMeController.getMerchantMe);
merchantRouter.post("/charge",          authMiddleware, isMerchant, chargeController.charge);
merchantRouter.post("/charge/confirm",  authMiddleware,             confirmChargeController.confirmCharge);
merchantRouter.get("/transactions",     authMiddleware, isMerchant, getMerchantTransactionsController.getMerchantTransactions);
merchantRouter.get("/settlements",      authMiddleware, isMerchant, getSettlementsController.getSettlements);
merchantRouter.put("/webhook",          authMiddleware, isMerchant, updateWebhookController.updateWebhook);

module.exports = merchantRouter;    