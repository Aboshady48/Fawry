const express = require("express");
const app = express();
const indexRouter = express.Router();
const authRauthIndexRouterouter = require("../Auth/router/authIndex.route");

indexRouter.use("/auth", authRauthIndexRouterouter);

module.exports = indexRouter;