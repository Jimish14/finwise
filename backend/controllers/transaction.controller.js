const { v4: uuidv4 } = require("uuid");
const Transaction = require("../models/transaction.model");
const { rebuildMonthlySummary, getMonthStr } = require("../utils/monthlySummaryHelper");
const axios = require("axios");
const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit");

// @GET /api/transactions
const getTransactions = async (req, res) => {
  try {
    const { type, category, startDate, endDate, page = 1, limit = 20 } = req.query;
    const filter = { user_id: req.user._id };

    if (type) filter.type = type;
    if (category) filter.category = category;
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [transactions, total] = await Promise.all([
      Transaction.find(filter).sort({ date: -1 }).skip(skip).limit(Number(limit)),
      Transaction.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: transactions,
      pagination: { total, page: Number(page), pages: Math.ceil(total / Number(limit)) },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// @GET /api/transactions/:id
const getTransaction = async (req, res) => {
  try {
    const txn = await Transaction.findOne({ _id: req.params.id, user_id: req.user._id });
    if (!txn) return res.status(404).json({ success: false, error: "Transaction not found" });
    res.json({ success: true, data: txn });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// @POST /api/transactions
const createTransaction = async (req, res) => {
  try {
    const body = req.body;

    // Auto-categorize if category not provided
    let category = body.category;
    if (!category && (body.title || body.merchant_name)) {
      try {
        const aiRes = await axios.post(
          `${process.env.AI_SERVICE_URL}/api/categorize`,
          { description: body.title || body.description, merchant_name: body.merchant_name, amount: body.amount },
          { timeout: 3000 }
        );
        if (aiRes.data?.data?.category) category = aiRes.data.data.category;
      } catch (_) {
        category = body.category || "Miscellaneous";
      }
    }

    const txn = await Transaction.create({
      ...body,
      user_id: req.user._id,
      transaction_id: uuidv4(),
      category: category || "Miscellaneous",
    });

    // Rebuild monthly summary for affected month
    const monthStr = getMonthStr(txn.date);
    await rebuildMonthlySummary(req.user._id, monthStr);

    res.status(201).json({ success: true, data: txn });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// @PUT /api/transactions/:id
const updateTransaction = async (req, res) => {
  try {
    const txn = await Transaction.findOneAndUpdate(
      { _id: req.params.id, user_id: req.user._id },
      req.body,
      { new: true, runValidators: true }
    );
    if (!txn) return res.status(404).json({ success: false, error: "Transaction not found" });

    await rebuildMonthlySummary(req.user._id, getMonthStr(txn.date));
    res.json({ success: true, data: txn });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// @DELETE /api/transactions/:id
const deleteTransaction = async (req, res) => {
  try {
    const txn = await Transaction.findOneAndDelete({ _id: req.params.id, user_id: req.user._id });
    if (!txn) return res.status(404).json({ success: false, error: "Transaction not found" });

    await rebuildMonthlySummary(req.user._id, getMonthStr(txn.date));
    res.json({ success: true, data: {} });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// @GET /api/transactions/stats/overview - Dashboard summary
const getOverview = async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const [incomeAgg, expenseAgg, categoryAgg, recentTxns] = await Promise.all([
      Transaction.aggregate([
        { $match: { user_id: req.user._id, type: "income", date: { $gte: startOfMonth, $lte: endOfMonth } } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      Transaction.aggregate([
        { $match: { user_id: req.user._id, type: "expense", date: { $gte: startOfMonth, $lte: endOfMonth } } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      Transaction.aggregate([
        { $match: { user_id: req.user._id, type: "expense", date: { $gte: startOfMonth, $lte: endOfMonth } } },
        { $group: { _id: "$category", total: { $sum: "$amount" } } },
        { $sort: { total: -1 } },
        { $limit: 6 },
      ]),
      Transaction.find({ user_id: req.user._id }).sort({ date: -1 }).limit(5),
    ]);

    const totalIncome  = incomeAgg[0]?.total  || 0;
    const totalExpense = expenseAgg[0]?.total || 0;

    res.json({
      success: true,
      data: {
        totalIncome,
        totalExpense,
        netSavings: totalIncome - totalExpense,
        savingsRate: totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome * 100).toFixed(1) : 0,
        categoryBreakdown: categoryAgg,
        recentTransactions: recentTxns,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// @GET /api/transactions/export?format=excel|pdf
const exportTransactions = async (req, res) => {
  try {
    const { type, category, startDate, endDate, format = "excel" } = req.query;
    const filter = { user_id: req.user._id };

    if (type) filter.type = type;
    if (category) filter.category = category;
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }

    const transactions = await Transaction.find(filter).sort({ date: -1 }).lean();

    if (format === "pdf") {
      const filename = `transactions-${new Date().toISOString().slice(0, 10)}.pdf`;
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

      const doc = new PDFDocument({ margin: 36, size: "A4" });
      doc.pipe(res);

      doc.fontSize(16).text("Transactions Report", { align: "left" });
      doc.moveDown(0.25);
      doc.fontSize(10).fillColor("#666").text(`Generated: ${new Date().toLocaleString("en-IN")}`);
      doc.moveDown(0.75);
      doc.fillColor("#000");

      let totalIncome = 0;
      let totalExpense = 0;
      transactions.forEach((t) => {
        if (t.type === "income") totalIncome += Number(t.amount || 0);
        else totalExpense += Number(t.amount || 0);
      });
      doc.fontSize(10).text(`Total Transactions: ${transactions.length}`);
      doc.text(`Total Income: Rs ${totalIncome.toLocaleString("en-IN")}`);
      doc.text(`Total Expense: Rs ${totalExpense.toLocaleString("en-IN")}`);
      doc.moveDown();

      doc.font("Helvetica-Bold").fontSize(10).text("Date", 36, doc.y, { continued: true, width: 70 });
      doc.text("Title", { continued: true, width: 160 });
      doc.text("Type", { continued: true, width: 60 });
      doc.text("Category", { continued: true, width: 90 });
      doc.text("Amount", { width: 100 });
      doc.font("Helvetica");

      doc.moveDown(0.3);
      transactions.forEach((t) => {
        if (doc.y > 760) doc.addPage();
        const amount = Number(t.amount || 0).toLocaleString("en-IN");
        doc.fontSize(9).text(new Date(t.date).toLocaleDateString("en-IN"), 36, doc.y, { continued: true, width: 70 });
        doc.text((t.title || "-").slice(0, 28), { continued: true, width: 160 });
        doc.text(t.type || "-", { continued: true, width: 60 });
        doc.text((t.category || "-").slice(0, 15), { continued: true, width: 90 });
        doc.text(`${t.type === "income" ? "+" : "-"}Rs ${amount}`, { width: 100 });
      });

      doc.end();
      return;
    }

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Transactions");

    sheet.columns = [
      { header: "Date", key: "date", width: 16 },
      { header: "Title", key: "title", width: 28 },
      { header: "Type", key: "type", width: 12 },
      { header: "Category", key: "category", width: 18 },
      { header: "Amount", key: "amount", width: 14 },
      { header: "Merchant", key: "merchant_name", width: 22 },
      { header: "Payment Method", key: "payment_method", width: 18 },
      { header: "Essential Flag", key: "essential_flag", width: 16 },
      { header: "Notes", key: "description", width: 30 },
    ];

    transactions.forEach((t) => {
      sheet.addRow({
        date: new Date(t.date).toLocaleDateString("en-IN"),
        title: t.title || "",
        type: t.type || "",
        category: t.category || "",
        amount: Number(t.amount || 0),
        merchant_name: t.merchant_name || "",
        payment_method: t.payment_method || "",
        essential_flag: t.essential_flag || "",
        description: t.description || "",
      });
    });

    sheet.getRow(1).font = { bold: true };
    const filename = `transactions-${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

module.exports = { getTransactions, getTransaction, createTransaction, updateTransaction, deleteTransaction, getOverview, exportTransactions };