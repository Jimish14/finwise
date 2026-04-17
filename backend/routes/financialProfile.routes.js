const express = require("express");
const r = express.Router();
const { getProfile, upsertProfile } = require("../controllers/financialProfile.controller");
const { protect } = require("../middleware/auth.middleware");
r.use(protect);
r.route("/").get(getProfile).post(upsertProfile).put(upsertProfile);
module.exports = r;