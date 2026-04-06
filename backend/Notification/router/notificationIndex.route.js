const express = require("express");
const notificationRouter = express.Router();
const authMiddleware            = require("../../middleware/authMiddleware.middleware");
const getNotificationsController = require("../controllers/getNotifications.controller");
const markAsReadController       = require("../controllers/markAsRead.controller");
const markAllAsReadController    = require("../controllers/markAllAsRead.controller");

notificationRouter.get("/",              authMiddleware, getNotificationsController.getNotifications);
notificationRouter.patch("/:id/read",    authMiddleware, markAsReadController.markAsRead);
notificationRouter.patch("/read-all",    authMiddleware, markAllAsReadController.markAllAsRead);

module.exports = notificationRouter;