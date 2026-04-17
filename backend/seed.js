const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

// Import your models (adjust paths if necessary)
const User = require("./models/user.model");
const FinancialProfile = require("./models/financialProfile.model");
const MonthlySummary = require("./models/monthlySummary.model");
const Transaction = require("./models/transaction.model");
const Goal = require("./models/goal.model");
const Investment = require("./models/investment.model");

// 🚨 REPLACE WITH YOUR MONGODB CONNECTION STRING
const MONGO_URI = "mongodb://localhost:27017/finwise"; 

const seedDatabase = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("🔥 Connected to DB. Clearing old data...");

    // Clear existing data
    await User.deleteMany({});
    await FinancialProfile.deleteMany({});
    await MonthlySummary.deleteMany({});
    await Transaction.deleteMany({});
    await Goal.deleteMany({});
    await Investment.deleteMany({});

    // 1. CREATE USER
    const user = await User.create({
      name: "Rahul Sharma",
      email: "rahul@example.com",
      password_hash: "password123" // <-- Just pass the plain string! Mongoose will hash it for you.
    });
    console.log("✅ User created:", user._id);

    // 2. CREATE FINANCIAL PROFILE
    await FinancialProfile.create({
      user_id: user._id,
      monthly_income: 85000,
      income_type: "fixed",
      fixed_expenses: 32000,
      current_balance: 145000,
      total_savings: 145000,
      emergency_fund_balance: 50000, // Low emergency fund to trigger risk penalty!
      investment_balance: 60000,
      risk_profile: "medium"
    });
    console.log("✅ Financial Profile created");

    // 3. GENERATE 6 MONTHS OF HISTORY (For ML Linear Regression)
    const months = [
      { year: 2025, month: 10, income: 85000, expense: 55000 }, // Nov 2025
      { year: 2025, month: 11, income: 85000, expense: 60000 }, // Dec 2025
      { year: 2026, month: 0,  income: 85000, expense: 58000 }, // Jan 2026
      { year: 2026, month: 1,  income: 85000, expense: 62000 }, // Feb 2026
      { year: 2026, month: 2,  income: 85000, expense: 68000 }, // Mar 2026
      { year: 2026, month: 3,  income: 85000, expense: 71000 }  // Apr 2026 (Trend: saving less over time)
    ];

    for (let i = 0; i < months.length; i++) {
      const data = months[i];
      const monthString = `${data.year}-${String(data.month + 1).padStart(2, '0')}`;
      
      await MonthlySummary.create({
        user_id: user._id,
        month: monthString,
        total_income: data.income,
        total_expense: data.expense,
        total_savings: data.income - data.expense,
        savings_rate: ((data.income - data.expense) / data.income) * 100,
        essential_expense: 35000,
        non_essential_expense: data.expense - 35000,
        top_spending_category: "Food",
        discretionary_spending: data.expense - 35000,
      });

      // Generate Transactions for this month
      // Income
      await Transaction.create({
        user_id: user._id, transaction_id: `TXN_INC_${i}`, amount: data.income, type: "income",
        category: "Salary", title: "Monthly Salary", date: new Date(data.year, data.month, 1)
      });

      // Recurring Expenses (Rent, Netflix)
      await Transaction.create({
        user_id: user._id, transaction_id: `TXN_RENT_${i}`, amount: 25000, type: "expense",
        category: "Bills", title: "House Rent", merchant_name: "Landlord", date: new Date(data.year, data.month, 5)
      });
      await Transaction.create({
        user_id: user._id, transaction_id: `TXN_NETFLIX_${i}`, amount: 649, type: "expense",
        category: "Entertainment", title: "Netflix Subscription", merchant_name: "Netflix", date: new Date(data.year, data.month, 10)
      });

      // Weekend Overspending Logic
      // Generating 4 weekends per month
      for (let w = 1; w <= 4; w++) {
        // Saturday (High spending to trigger behavior warning)
        await Transaction.create({
          user_id: user._id, transaction_id: `TXN_WKND_SAT_${i}_${w}`, amount: 2500 + Math.floor(Math.random()*1000), 
          type: "expense", category: "Food", title: "Dinner & Drinks", merchant_name: "Zomato", 
          date: new Date(data.year, data.month, w * 7 - 1) // Saturday
        });
        // Wednesday (Low weekday spending)
        await Transaction.create({
          user_id: user._id, transaction_id: `TXN_WKDAY_WED_${i}_${w}`, amount: 250, 
          type: "expense", category: "Food", title: "Office Lunch", merchant_name: "Swiggy", 
          date: new Date(data.year, data.month, w * 7 - 4) // Wednesday
        });
      }
    }
    console.log("✅ 6 Months of Monthly Summaries & Transactions created");

    // 4. CREATE GOALS
    await Goal.create({
      user_id: user._id,
      goal_name: "Buy A Bike",
      goal_category: "vehicle",
      current_price: 165000,
      expected_inflation_rate: 6,
      current_amount: 45000, // 27% funded
      existing_allocation: 45000,
      goal_start_date: new Date("2026-01-01"),
      goal_target_date: new Date("2026-08-01"),
      priority_level: "high"
    });

    await Goal.create({
      user_id: user._id,
      goal_name: "Bali Trip",
      goal_category: "travel",
      current_price: 120000,
      expected_inflation_rate: 5,
      current_amount: 15000,
      existing_allocation: 15000,
      goal_start_date: new Date("2026-02-15"),
      goal_target_date: new Date("2026-12-15"),
      priority_level: "medium"
    });
    console.log("✅ Financial Goals created");

    // 5. CREATE INVESTMENTS
    await Investment.create({
      user_id: user._id,
      investment_type: "Mutual Funds",
      name: "HDFC Nifty 50 Index",
      amount_invested: 50000,
      current_value: 58500, // Show profit!
      expected_return_rate: 12,
      investment_start_date: new Date("2025-05-01")
    });

    await Investment.create({
      user_id: user._id,
      investment_type: "Stocks",
      name: "Tata Motors",
      amount_invested: 20000,
      current_value: 18500, // Show loss!
      expected_return_rate: 15,
      investment_start_date: new Date("2026-01-15")
    });
    console.log("✅ Investments created");

    console.log("🎉 DATABASE SEEDING COMPLETE! You can now log into the app using: rahul@example.com / password123");
    process.exit();

  } catch (error) {
    console.error("Error seeding data:", error);
    process.exit(1);
  }
};

seedDatabase();