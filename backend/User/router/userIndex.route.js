const express = require("express");
const userRouter = express.Router();
const authMiddleware = require("../../middleware/authMiddleware.middleware");
const upload = require("../../config/multer");

const getMeController        = require("../controllers/getMe.controller");
const updateMeController     = require("../controllers/updateMe.controller");
const changePhoneController  = require("../controllers/changePhone.controller");
const uploadAvatarController = require("../controllers/uploadAvatar.controller");

userRouter.get("/me",                      authMiddleware, getMeController.getMe);
userRouter.put("/me",                      authMiddleware, updateMeController.updateMe);
userRouter.post("/me/change-phone",        authMiddleware, changePhoneController.requestChangePhone);
userRouter.post("/me/change-phone/verify", authMiddleware, changePhoneController.verifyChangePhone);
userRouter.post("/me/avatar",              authMiddleware, upload.single("avatar"), uploadAvatarController.uploadAvatar);

module.exports = userRouter;