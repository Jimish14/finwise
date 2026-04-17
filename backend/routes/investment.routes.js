const express = require("express");
const r = express.Router();
const { getInvestments, createInvestment, updateInvestment, deleteInvestment } = require("../controllers/investment.controller");
const { protect } = require("../middleware/auth.middleware");
r.use(protect);
r.route("/").get(getInvestments).post(createInvestment);
r.route("/:id").put(updateInvestment).delete(deleteInvestment);
module.exports = r;