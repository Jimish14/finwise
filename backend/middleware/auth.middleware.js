const jwt = require("jsonwebtoken");
const User = require("../models/user.model");

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return res.status(401).json({ success: false, error: "Not authorized, no token" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select("-password_hash");
    if (!req.user) {
      return res.status(401).json({ success: false, error: "User not found" });
    }
    next();
  } catch (error) {
    return res.status(401).json({ success: false, error: "Token invalid or expired" });
  }
};

module.exports = { protect };