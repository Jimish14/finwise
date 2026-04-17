const User = require("../models/user.model");
const FinancialProfile = require("../models/financialProfile.model");
const generateToken = require("../utils/generateToken");

// @POST /api/auth/register
const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ success: false, error: "All fields are required" });

    const exists = await User.findOne({ email });
    if (exists)
      return res.status(400).json({ success: false, error: "Email already registered" });

    const user = await User.create({ name, email, password_hash: password });
    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      data: { _id: user._id, name: user.name, email: user.email, token },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// @POST /api/auth/login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user || !(await user.matchPassword(password)))
      return res.status(401).json({ success: false, error: "Invalid credentials" });

    const token = generateToken(user._id);
    res.json({
      success: true,
      data: { _id: user._id, name: user.name, email: user.email, token },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// @GET /api/auth/me
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("-password_hash");
    const profile = await FinancialProfile.findOne({ user_id: req.user._id });
    res.json({ success: true, data: { user, profile } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

module.exports = { register, login, getMe };