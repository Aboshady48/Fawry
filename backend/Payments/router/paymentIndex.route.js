const express = require("express");
const paymentRouter = express.Router();
const authMiddleware            = require("../../middleware/authMiddleware.middleware");
const transferController        = require("../controllers/transfer.controller");
const requestPaymentController  = require("../controllers/requestPayment.controller");
const getPaymentRequestController = require("../controllers/getPaymentRequest.controller");
const payRequestController      = require("../controllers/payRequest.controller");

paymentRouter.post("/transfer",               authMiddleware, transferController.transfer);
paymentRouter.post("/request",                authMiddleware, requestPaymentController.requestPayment);
paymentRouter.get("/request/:requestId",      authMiddleware, getPaymentRequestController.getPaymentRequest);
paymentRouter.post("/request/:requestId/pay", authMiddleware, payRequestController.payRequest);

module.exports = paymentRouter;