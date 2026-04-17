const express = require("express");
const r = express.Router();
const { getMonthlySummaries } = require("../controllers/monthlySummary.controller");
const { protect } = require("../middleware/auth.middleware");
r.use(protect);
r.get("/", getMonthlySummaries);
module.exports = r;