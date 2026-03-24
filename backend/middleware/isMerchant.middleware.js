const isMerchant = (req, res, next) => {
  if (req.user.role !== "merchant") {
    return res.status(403).json({ message: "Access denied. Merchants only" });
  }
  next();
};

module.exports = isMerchant;