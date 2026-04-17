require("dotenv").config();
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const connectDB = require("./config/db");

// Route imports
const authRoutes            = require("./routes/auth.routes");
const transactionRoutes     = require("./routes/transaction.routes");
const goalRoutes            = require("./routes/goal.routes");
const investmentRoutes      = require("./routes/investment.routes");
const financialProfileRoutes= require("./routes/financialProfile.routes");
const monthlySummaryRoutes  = require("./routes/monthlySummary.routes");
const aiRoutes              = require("./routes/ai.routes");

// Connect to MongoDB
connectDB();

const app = express();

// ── Middleware ──────────────────────────────────
const allowedOrigins = [
  process.env.CLIENT_URL || "http://localhost:5173",
  "http://localhost:8081",
  "http://localhost:8082",
  "http://localhost:8083",
];
const localNetworkOriginRegex = /^https?:\/\/((localhost)|(127\.0\.0\.1)|(10\.\d{1,3}\.\d{1,3}\.\d{1,3})|(172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})|(192\.168\.\d{1,3}\.\d{1,3}))(:\d+)?$/;

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow non-browser tools, known local UIs, and LAN development origins.
      if (!origin || allowedOrigins.includes(origin) || localNetworkOriginRegex.test(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
if (process.env.NODE_ENV === "development") app.use(morgan("dev"));

// ── API Routes ──────────────────────────────────
app.use("/api/auth",             authRoutes);
app.use("/api/transactions",     transactionRoutes);
app.use("/api/goals",            goalRoutes);
app.use("/api/investments",      investmentRoutes);
app.use("/api/financial-profile",financialProfileRoutes);
app.use("/api/monthly-summary",  monthlySummaryRoutes);
app.use("/api/ai",               aiRoutes);

// ── Health Check ────────────────────────────────
app.get("/api/ping", (req, res) => res.json({ message: "Server is running 🚀" }));

// ── Global Error Handler ────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.statusCode || 500).json({
    success: false,
    error: err.message || "Server Error",
  });
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`🤖 AI Service expected at: ${process.env.AI_SERVICE_URL}`);
});