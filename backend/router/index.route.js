const express = require("express");
const app = express();
const indexRouter = express.Router();
const authRauthIndexRouterouter = require("../Auth/router/authIndex.route");
const userRouter = require("../User/router/userIndex.route");
const adminRouter = require("../Admin/routers/admin.route");
const walletRouter = require("../Wallet/router/walletIndex.route");
const paymentRouter = require("../Payments/router/paymentIndex.route");
const billRouter = require("../Bill/router/billIndex.route");
const merchantRouter = require("../Merchant/router/merchantIndex.route");
const agentRouter = require("../Agent/router/agentIndex.route");
const notificationRouter = require("../Notification/router/notificationIndex.route");

indexRouter.use("/auth", authRauthIndexRouterouter);
indexRouter.use("/user", userRouter);
indexRouter.use("/admin", adminRouter);
indexRouter.use("/wallet", walletRouter);
indexRouter.use("/payment", paymentRouter);
indexRouter.use("/bills", billRouter);
indexRouter.use("/merchants", merchantRouter);
indexRouter.use("/agents", agentRouter);
indexRouter.use("/notifications", notificationRouter);

module.exports = indexRouter;