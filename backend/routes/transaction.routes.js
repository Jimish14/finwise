const express = require("express");
const router = express.Router();
const {
  getTransactions, getTransaction, createTransaction,
  updateTransaction, deleteTransaction, getOverview, exportTransactions,
} = require("../controllers/transaction.controller");
const { protect } = require("../middleware/auth.middleware");

router.use(protect);
router.get("/overview", getOverview);
router.get("/export", exportTransactions);
router.route("/").get(getTransactions).post(createTransaction);
router.route("/:id").get(getTransaction).put(updateTransaction).delete(deleteTransaction);
module.exports = router;