const express = require("express");
const billRouter = express.Router();
const authMiddleware              = require("../../middleware/authMiddleware.middleware");
const getBillersController        = require("../controllers/getBillers.controller");
const getBillerByIdController     = require("../controllers/getBillerById.controller");
const inquireBillController       = require("../controllers/inquireBill.controller");
const payBillController           = require("../controllers/payBill.controller");
const getBillHistoryController    = require("../controllers/getBillHistory.controller");
const getBillReceiptController    = require("../controllers/getBillReceipt.controller");

billRouter.get("/billers",                    authMiddleware, getBillersController.getBillers);
billRouter.get("/billers/:billerId",          authMiddleware, getBillerByIdController.getBillerById);
billRouter.post("/inquiry",                   authMiddleware, inquireBillController.inquireBill);
billRouter.get("/history",                    authMiddleware, getBillHistoryController.getBillHistory);
billRouter.get("/:billPaymentId/receipt",     authMiddleware, getBillReceiptController.getBillReceipt);
billRouter.post("/pay",                       authMiddleware, payBillController.payBill);
module.exports = billRouter;