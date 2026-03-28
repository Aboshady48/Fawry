const express = require("express");
const adminRouter = express.Router();
const authMiddleware        = require("../../middleware/authMiddleware.middleware");
const isAdmin               = require("../../middleware/isAdmin.middleware");
const getUserByIdController = require("../controllers/getUserById.controller");
const getAllUsersController = require("../controllers/getAllUsers.controller");
const updateUserStatusController = require("../controllers/updateUserStatus.controller");

adminRouter.get("/users", authMiddleware, isAdmin, getAllUsersController.getAllUsers);

adminRouter.get("/user/:id", authMiddleware, isAdmin, getUserByIdController.getUserById);

adminRouter.patch("/user/:id/status", authMiddleware, isAdmin, updateUserStatusController.updateUserStatus);

module.exports = adminRouter