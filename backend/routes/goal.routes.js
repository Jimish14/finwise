// goal.routes.js
const express = require("express");
const r = express.Router();
const { getGoals, getGoal, createGoal, updateGoal, deleteGoal } = require("../controllers/goal.controller");
const { protect } = require("../middleware/auth.middleware");
r.use(protect);
r.route("/").get(getGoals).post(createGoal);
r.route("/:id").get(getGoal).put(updateGoal).delete(deleteGoal);
module.exports = r;