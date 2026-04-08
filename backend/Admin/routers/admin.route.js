const express = require("express");
const adminRouter = express.Router();
const authMiddleware                = require("../../middleware/authMiddleware.middleware");
const isAdmin                       = require("../../middleware/isAdmin.middleware");
const getDashboardController        = require("../controllers/getDashboard.controller");
const getUserByIdController         = require("../controllers/getUserById.controller");
const getAllUsersController          = require("../controllers/getAllUsers.controller");
const updateUserStatusController    = require("../controllers/updateUserStatus.controller");
const getRevenueController          = require("../controllers/getRevenue.controller");
const refundController              = require("../controllers/refund.controller");
const getAllTransactionsController   = require("../controllers/getAllTransactions.controller");
const getSettlementReportController = require("../controllers/getSettlementReport.controller");
const getRevenueReportController    = require("../controllers/getRevenueReport.controller");
const getFraudFlagsController       = require("../controllers/getFraudFlags.controller");
const resolveFraudFlagController    = require("../controllers/resolveFraudFlag.controller");

adminRouter.get("/dashboard",             authMiddleware, isAdmin, getDashboardController.getDashboard);
adminRouter.get("/users",                 authMiddleware, isAdmin, getAllUsersController.getAllUsers);
adminRouter.get("/user/:id",              authMiddleware, isAdmin, getUserByIdController.getUserById);
adminRouter.patch("/users/:id/status",    authMiddleware, isAdmin, updateUserStatusController.updateUserStatus);
adminRouter.get("/transactions",          authMiddleware, isAdmin, getAllTransactionsController.getAllTransactions);
adminRouter.get("/revenue",               authMiddleware, isAdmin, getRevenueController.getRevenue);
adminRouter.get("/reports/settlement",    authMiddleware, isAdmin, getSettlementReportController.getSettlementReport);
adminRouter.get("/reports/revenue",       authMiddleware, isAdmin, getRevenueReportController.getRevenueReport);
adminRouter.post("/refund",               authMiddleware, isAdmin, refundController.refund);
adminRouter.get("/fraud-flags",           authMiddleware, isAdmin, getFraudFlagsController.getFraudFlags);
adminRouter.patch("/fraud-flags/:id/resolve", authMiddleware, isAdmin, resolveFraudFlagController.resolveFraudFlag);

module.exports = adminRouter;