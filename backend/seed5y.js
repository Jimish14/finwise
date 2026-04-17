const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid"); // Make sure to npm install uuid if you haven't!

const User = require("./models/user.model");
const FinancialProfile = require("./models/financialProfile.model");
const MonthlySummary = require("./models/monthlySummary.model");
const Transaction = require("./models/transaction.model");
const Goal = require("./models/goal.model");
const Investment = require("./models/investment.model");

// 🚨 REPLACE WITH YOUR EXACT MONGODB URI 🚨
const MONGO_URI = "mongodb://127.0.0.1:27017/finwise"; 

const seedDatabase = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("🔥 Connected to DB. Clearing old data...");

    await User.deleteMany({});
    await FinancialProfile.deleteMany({});
    await MonthlySummary.deleteMany({});
    await Transaction.deleteMany({});
    await Goal.deleteMany({});
    await Investment.deleteMany({});

    // 1. CREATE USER
    const user = await User.create({
      name: "Jimish makwana",
      email: "jimish@gamil.com",
      password_hash: "password123" // Mongoose hook will hash this!
    });
    console.log("✅ User created");

    // 2. CREATE FINANCIAL PROFILE (Year 5 stats)
    await FinancialProfile.create({
      user_id: user._id,
      monthly_income: 120000, // Current 2026 income
      income_type: "fixed",
      fixed_expenses: 45000,
      current_balance: 350000,
      total_savings: 850000,
      emergency_fund_balance: 200000, // Healthy emergency fund!
      investment_balance: 500000,
      risk_profile: "medium"
    });
    console.log("✅ Financial Profile created");

    // 3. GENERATE 5 YEARS OF DATA (Jan 2021 to April 2026 = 64 months)
    console.log("⏳ Generating 5 Years of Transactions and Summaries. This might take a few seconds...");
    
    let currentIncome = 60000;
    let baseExpense = 35000;
    
    for (let monthOffset = 0; monthOffset < 64; monthOffset++) {
      // Calculate Date
      const date = new Date(2021, 0 + monthOffset, 1);
      const year = date.getFullYear();
      const month = date.getMonth(); // 0-11
      const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;

      // 🚨 AI TEST: Yearly Raise every January
      if (month === 0 && year > 2021) {
        currentIncome = Math.floor(currentIncome * 1.15); // 15% raise every year
        baseExpense = Math.floor(baseExpense * 1.08); // 8% lifestyle inflation
      }

      // 🚨 AI TEST: Festival Seasonality (Spikes in Oct, Nov, Dec)
      let monthlyExpense = baseExpense;
      if (month === 9 || month === 10) monthlyExpense *= 1.25; // Diwali Shopping
      if (month === 11) monthlyExpense *= 1.15; // December Travel

      // Add a little randomness so it's not perfectly linear
      monthlyExpense += Math.floor(Math.random() * 5000) - 2500;
      
      const savings = currentIncome - monthlyExpense;

      // Create Summary
      await MonthlySummary.create({
        user_id: user._id,
        month: monthStr,
        total_income: currentIncome,
        total_expense: monthlyExpense,
        total_savings: savings,
        savings_rate: (savings / currentIncome) * 100,
        essential_expense: baseExpense * 0.6,
        non_essential_expense: monthlyExpense - (baseExpense * 0.6),
        top_spending_category: (month === 9 || month === 10) ? "Shopping" : "Food",
        discretionary_spending: monthlyExpense - (baseExpense * 0.6),
      });

      // --- GENERATE SPECIFIC TRANSACTIONS FOR THIS MONTH ---

      // 1. Income
      await Transaction.create({
        user_id: user._id, transaction_id: uuidv4(), amount: currentIncome, type: "income",
        category: "Salary", title: "Monthly Salary", date: new Date(year, month, 1)
      });

      // 2. Fixed Recurring
      await Transaction.create({
        user_id: user._id, transaction_id: uuidv4(), amount: 15000, type: "expense",
        category: "Bills", title: "House Rent", merchant_name: "Landlord", date: new Date(year, month, 5)
      });
      await Transaction.create({
        user_id: user._id, transaction_id: uuidv4(), amount: 649, type: "expense",
        category: "Entertainment", title: "Netflix Subscription", merchant_name: "Netflix", date: new Date(year, month, 10)
      });
      await Transaction.create({
        user_id: user._id, transaction_id: uuidv4(), amount: 1500, type: "expense",
        category: "Health", title: "Gym Membership", merchant_name: "Gold's Gym", date: new Date(year, month, 12)
      });

      // 3. Weekend Behavior (Saturdays)
      for (let w = 1; w <= 4; w++) {
        await Transaction.create({
          user_id: user._id, transaction_id: uuidv4(), amount: 1500 + Math.floor(Math.random() * 1500), 
          type: "expense", category: "Food", title: "Weekend Dining", merchant_name: "Zomato", 
          date: new Date(year, month, w * 7 - 1) 
        });
      }

      // 4. Festival Spikes (Only in Oct/Nov)
      if (month === 9 || month === 10) {
        await Transaction.create({
          user_id: user._id, transaction_id: uuidv4(), amount: 8000 + Math.floor(Math.random() * 4000), 
          type: "expense", category: "Shopping", title: "Festival Shopping", merchant_name: "Amazon", 
          date: new Date(year, month, 15) 
        });
      }
    }
    console.log(`✅ 64 Months of Data generated successfully (Jan 2021 to April 2026)`);

    // 4. CREATE GOALS
    await Goal.create({
      user_id: user._id,
      goal_name: "House Down Payment",
      goal_category: "investment",
      current_price: 2500000,
      expected_inflation_rate: 8,
      current_amount: 850000, 
      existing_allocation: 850000,
      goal_start_date: new Date("2021-01-01"),
      goal_target_date: new Date("2028-12-01"),
      priority_level: "high"
    });

    await Goal.create({
      user_id: user._id,
      goal_name: "Bought Laptop (Completed)",
      goal_category: "gadget",
      current_price: 120000,
      current_amount: 120000, 
      existing_allocation: 120000,
      goal_start_date: new Date("2021-06-01"),
      goal_target_date: new Date("2023-01-01"),
      status: "completed",
      priority_level: "medium"
    });
    console.log("✅ Financial Goals created");

    // 5. CREATE INVESTMENTS (With 5-Year Histories)
    await Investment.create({
      user_id: user._id,
      investment_type: "Mutual Funds",
      name: "Parag Parikh Flexi Cap",
      amount_invested: 320000, // 5k a month for 64 months
      current_value: 485000, // Show massive 5-year returns
      expected_return_rate: 15,
      investment_start_date: new Date("2021-01-15")
    });

    await Investment.create({
      user_id: user._id,
      investment_type: "Crypto",
      name: "Bitcoin",
      amount_invested: 50000,
      current_value: 125000,
      expected_return_rate: 20,
      investment_start_date: new Date("2022-03-01")
    });
    console.log("✅ Long-term Investments created");

    console.log("🎉 MASSIVE 5-YEAR SEED COMPLETE! Log in with: rahul@example.com / password123");
    process.exit();

  } catch (error) {
    console.error("Error seeding data:", error);
    process.exit(1);
  }
};

seedDatabase();