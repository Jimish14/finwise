import client from './client';

// Upgraded unwrap function to pull the EXACT error message from your Node/Python backend
const unwrap = async (request) => {
  try {
    const response = await request;
    return { data: response.data.data }; 
  } catch (error) {
    const backendError = error.response?.data?.error || error.message;
    console.error("Backend API Error:", backendError);
    throw new Error(backendError);
  }
};

// Transactions & Summaries
export const fetchMonthlySummary = () => unwrap(client.get('/monthly-summary'));
export const fetchTransactions = () => unwrap(client.get('/transactions'));
export const addTransaction = (data) => unwrap(client.post('/transactions', data));

// AI Services
export const getFinancialHealth = () => unwrap(client.post('/ai/health-guard', {}));
export const getExpensePredictions = () => unwrap(client.post('/ai/predict-expense', { inflation_rate: 0.06 }));
// --- AI APIs ---
export const predictExpense = (data) => unwrap(client.post('/ai/predict-expense', data));
// Goals & Investments
export const fetchGoals = () => unwrap(client.get('/goals'));
// Replace the old getGoalPlan with this:
// Replace your getGoalPlan line with this:
export const getGoalPlan = (goalId) => unwrap(client.post(`/ai/goal-plan/${goalId}`));
// --- FINANCIAL PROFILE APIs ---
export const fetchFinancialProfile = () => unwrap(client.get('/financial-profile')); 
export const updateFinancialProfile = (data) => unwrap(client.post('/financial-profile', data));
// Add these to your exports.js file
export const addGoal = (goalData) => unwrap(client.post('/goals', goalData));
export const updateGoal = (id, goalData) => unwrap(client.put(`/goals/${id}`, goalData));
export const deleteGoal = (id) => unwrap(client.delete(`/goals/${id}`));

// --- INVESTMENT APIs ---
export const fetchInvestments = () => unwrap(client.get('/investments'));
export const addInvestment = (data) => unwrap(client.post('/investments', data));
export const updateInvestment = (id, data) => unwrap(client.put(`/investments/${id}`, data));
export const deleteInvestment = (id) => unwrap(client.delete(`/investments/${id}`));