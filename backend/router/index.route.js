const express = require("express");
const app = express();
const indexRouter = express.Router();
const authRauthIndexRouterouter = require("../Auth/router/authIndex.route");
const userRouter = require("../User/router/userIndex.route");
const adminRouter = require("../Admin/routers/admin.route");


indexRouter.use("/auth", authRauthIndexRouterouter);
indexRouter.use("/user", userRouter);
indexRouter.use("/admin", adminRouter);

module.exports = indexRouter;