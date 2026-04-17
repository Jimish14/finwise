# FinWise — AI-Powered Expense Tracker
### MERN Stack + Python Flask AI Service

---

## 📁 Project Structure

```
expense-tracker/
├── backend/                    # Node.js + Express API
│   ├── config/
│   │   └── db.js               # MongoDB connection
│   ├── controllers/
│   │   ├── auth.controller.js
│   │   ├── transaction.controller.js
│   │   ├── goal.controller.js
│   │   ├── investment.controller.js
│   │   ├── financialProfile.controller.js
│   │   ├── monthlySummary.controller.js
│   │   └── ai.controller.js    # Proxies to Flask AI service
│   ├── middleware/
│   │   └── auth.middleware.js  # JWT guard
│   ├── models/
│   │   ├── user.model.js
│   │   ├── transaction.model.js
│   │   ├── financialProfile.model.js
│   │   ├── goal.model.js
│   │   ├── investment.model.js
│   │   └── monthlySummary.model.js
│   ├── routes/                 # REST route definitions
│   ├── utils/
│   │   ├── generateToken.js
│   │   └── monthlySummaryHelper.js  # Auto-rebuilds summaries
│   ├── .env
│   ├── package.json
│   └── server.js
│
├── frontend/                   # React + Vite + Tailwind
│   ├── src/
│   │   ├── api/
│   │   │   └── axios.js        # Configured axios with JWT interceptor
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── Sidebar.jsx
│   │   │   │   └── Layout.jsx
│   │   │   └── ui/
│   │   │       └── index.jsx   # StatCard, Modal, Badge, fmt helpers
│   │   ├── context/
│   │   │   └── AuthContext.jsx # Global auth state
│   │   ├── pages/
│   │   │   ├── auth/
│   │   │   │   ├── Login.jsx
│   │   │   │   └── Register.jsx  (2-step: account + financial profile)
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Transactions.jsx  (CRUD + AI auto-categorize)
│   │   │   ├── Goals.jsx
│   │   │   ├── Investments.jsx
│   │   │   ├── Profile.jsx
│   │   │   └── ai/
│   │   │       ├── AIPredictor.jsx
│   │   │       ├── HealthGuard.jsx
│   │   │       └── GoalCalculator.jsx
│   │   ├── App.jsx             # Routes
│   │   ├── main.jsx
│   │   └── index.css           # Design system + Tailwind
│   ├── index.html
│   ├── vite.config.js          # Proxy → backend :5001
│   ├── tailwind.config.js
│   └── package.json
│
└── ai_service/                 # Python Flask AI Models
    ├── app.py                  # Flask REST API
    ├── requirements.txt
    └── models/
        ├── transaction_categorizer.py
        ├── expense_predictor.py
        ├── financial_health_guard.py
        └── goal_calculator.py
```

---

## 🚀 Setup & Run

### Prerequisites
- Node.js >= 18
- MongoDB running locally (or MongoDB Atlas URI)
- Python 3.10+

### 1. Start MongoDB
```bash
mongod
```

### 2. Backend
```bash
cd backend
npm install
# Edit .env → set MONGO_URI and JWT_SECRET
npm run dev      # Starts on :5001
```

### 3. AI Service
```bash
cd ai_service
pip install -r requirements.txt
python app.py    # Starts on :5000
```

### 4. Frontend
```bash
cd frontend
npm install
npm run dev      # Starts on :5173
```

Open: **http://localhost:5173**

---

## 🔌 API Reference

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/register | Register user |
| POST | /api/auth/login    | Login, returns JWT |
| GET  | /api/auth/me       | Get current user + profile |

### Transactions
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET    | /api/transactions           | List (filter, paginate) |
| POST   | /api/transactions           | Create (auto AI categorize) |
| PUT    | /api/transactions/:id       | Update |
| DELETE | /api/transactions/:id       | Delete |
| GET    | /api/transactions/overview  | Dashboard summary |

### Goals, Investments, Profile — full CRUD at `/api/goals`, `/api/investments`, `/api/financial-profile`

### AI Endpoints (all require auth)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/ai/categorize       | Categorize a transaction |
| POST | /api/ai/predict-expense  | Predict next month expense |
| POST | /api/ai/health-guard     | Financial health analysis |
| POST | /api/ai/goal-plan/:id    | Goal plan for a goal |

---

## 🤖 AI Features

| Feature | Model | How it Works |
|---------|-------|-------------|
| Transaction Categorizer | TF-IDF + Logistic Regression | Trained on 80+ labeled samples. Rule-based fallback. Retrains on user corrections. |
| Expense Predictor | Linear Regression + Adjustments | Trend from time-series + inflation × festival × behavior × events × subscriptions |
| Financial Health Guard | Rule Engine + Weighted Scoring | 6 dimensions scored 0–100. Real-time risk alerts. Personalized advice generation. |
| Smart Goal Calculator | Inflation FV + Gap Analysis | Future-values goal, computes savings gap, finds spending cuts, generates milestones |

---

## 🎨 Design System

- **Theme**: Dark navy (#050914) + Amber/Gold (#f59e0b) accents
- **Fonts**: Syne (headings) + DM Sans (body) + JetBrains Mono (numbers)
- **Components**: glass-card, btn-primary, btn-ghost, input-field, Badge, Modal, StatCard

---

## ⚙️ Environment Variables

```env
# backend/.env
PORT=5001
MONGO_URI=mongodb://localhost:27017/expense_tracker
JWT_SECRET=your_secret_here
JWT_EXPIRE=30d
AI_SERVICE_URL=http://localhost:5000
NODE_ENV=development
```