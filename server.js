const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { parseTransaction } = require('./parser');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(os.tmpdir(), 'personal-accounting-data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const TRANSACTIONS_FILE = path.join(DATA_DIR, 'transactions.json');
const BUDGET_FILE = path.join(DATA_DIR, 'budget.json');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'accounting-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 }
  })
);
app.use(express.static(path.join(__dirname, 'public')));

function ensureDataFiles() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, JSON.stringify({ users: [] }, null, 2));
  }
  if (!fs.existsSync(TRANSACTIONS_FILE)) {
    fs.writeFileSync(TRANSACTIONS_FILE, JSON.stringify({ transactions: [] }, null, 2));
  }
  if (!fs.existsSync(BUDGET_FILE)) {
    fs.writeFileSync(BUDGET_FILE, JSON.stringify({ budgets: [] }, null, 2));
  }
}

function readJson(filePath, fallback) {
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return fallback;
  }
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function getMonthKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function getCurrentUser(req) {
  return req.session.userId ? { id: req.session.userId, username: req.session.username } : null;
}

function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: '请先登录' });
  }
  next();
}

function getUserData(userId) {
  const usersData = readJson(USERS_FILE, { users: [] });
  return usersData.users.find((user) => user.id === userId);
}

function saveUserData(usersData) {
  writeJson(USERS_FILE, usersData);
}

function getTransactionsForUser(userId) {
  const transactionsData = readJson(TRANSACTIONS_FILE, { transactions: [] });
  return transactionsData.transactions.filter((transaction) => transaction.userId === userId);
}

function saveTransactionsForUser(userId, transactions) {
  const transactionsData = readJson(TRANSACTIONS_FILE, { transactions: [] });
  const filtered = transactionsData.transactions.filter((transaction) => transaction.userId !== userId);
  writeJson(TRANSACTIONS_FILE, {
    transactions: [...filtered, ...transactions]
  });
}

function getBudgetForUser(userId, monthKey) {
  const budgetsData = readJson(BUDGET_FILE, { budgets: [] });
  return budgetsData.budgets.find((budget) => budget.userId === userId && budget.month === monthKey);
}

function saveBudgetForUser(userId, monthKey, budgetAmount) {
  const budgetsData = readJson(BUDGET_FILE, { budgets: [] });
  const otherBudgets = budgetsData.budgets.filter((budget) => !(budget.userId === userId && budget.month === monthKey));
  otherBudgets.push({ userId, month: monthKey, budgetAmount });
  writeJson(BUDGET_FILE, { budgets: otherBudgets });
}

ensureDataFiles();

app.get('/api/me', requireAuth, (req, res) => {
  res.json({ user: { id: req.session.userId, username: req.session.username } });
});

app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: '用户名和密码不能为空' });
  }

  const usersData = readJson(USERS_FILE, { users: [] });
  const existing = usersData.users.find((user) => user.username === username);
  if (existing) {
    return res.status(409).json({ error: '用户名已存在' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = {
    id: `user_${Date.now()}`,
    username,
    password: passwordHash,
    createdAt: new Date().toISOString()
  };

  usersData.users.push(user);
  saveUserData(usersData);

  req.session.userId = user.id;
  req.session.username = user.username;

  res.status(201).json({ message: '注册成功', user: { id: user.id, username: user.username } });
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const usersData = readJson(USERS_FILE, { users: [] });
  const user = usersData.users.find((item) => item.username === username);

  if (!user) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }

  const isValidPassword = await bcrypt.compare(password, user.password);
  if (!isValidPassword) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }

  req.session.userId = user.id;
  req.session.username = user.username;

  res.json({ message: '登录成功', user: { id: user.id, username: user.username } });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ message: '已退出登录' });
  });
});

app.post('/api/parse', (req, res) => {
  const { text } = req.body;
  if (!text || !String(text).trim()) {
    return res.json({ amount: 0, type: 'expense', category: '其他', note: '' });
  }
  res.json(parseTransaction(text));
});

app.post('/api/transactions', requireAuth, (req, res) => {
  const userId = req.session.userId;
  const { text, type, category, note, amount } = req.body;

  if (!text || !text.trim()) {
    return res.status(400).json({ error: '请输入记账内容' });
  }

  const parsed = parseTransaction(text);
  const finalType = type || parsed.type;
  const finalCategory = category || parsed.category;
  const finalAmount = amount || parsed.amount;
  const finalNote = note || parsed.note || text.trim();

  const transaction = {
    id: `tx_${Date.now()}`,
    userId,
    type: finalType,
    category: finalCategory,
    amount: Number(finalAmount),
    note: finalNote,
    createdAt: new Date().toISOString()
  };

  const transactionsData = readJson(TRANSACTIONS_FILE, { transactions: [] });
  transactionsData.transactions.push(transaction);
  writeJson(TRANSACTIONS_FILE, transactionsData);

  res.json({ message: '记账成功', transaction });
});

app.get('/api/transactions', requireAuth, (req, res) => {
  const userId = req.session.userId;
  const transactions = getTransactionsForUser(userId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ transactions });
});

app.put('/api/transactions/:id', requireAuth, (req, res) => {
  const userId = req.session.userId;
  const transactionId = req.params.id;
  const { type, category, note, amount, customCategory } = req.body;

  const transactionsData = readJson(TRANSACTIONS_FILE, { transactions: [] });
  const target = transactionsData.transactions.find((transaction) => transaction.id === transactionId && transaction.userId === userId);

  if (!target) {
    return res.status(404).json({ error: '记账记录不存在' });
  }

  const finalAmount = Number(amount);
  if (!Number.isFinite(finalAmount) || finalAmount < 0) {
    return res.status(400).json({ error: '金额必须是非负数字' });
  }

  target.type = type || target.type;
  target.category = customCategory && customCategory.trim() ? customCategory.trim() : (category || target.category);
  target.amount = finalAmount;
  target.note = note !== undefined ? note : target.note;

  writeJson(TRANSACTIONS_FILE, transactionsData);
  res.json({ message: '更新成功', transaction: target });
});

app.get('/api/summary', requireAuth, (req, res) => {
  const userId = req.session.userId;
  const monthKey = getMonthKey();
  const transactions = getTransactionsForUser(userId).filter((transaction) => transaction.createdAt.startsWith(monthKey.slice(0, 4)) || transaction.createdAt.includes(monthKey.slice(0, 7)));

  const totalExpense = transactions
    .filter((transaction) => transaction.type === 'expense')
    .reduce((sum, transaction) => sum + Number(transaction.amount), 0);
  const totalIncome = transactions
    .filter((transaction) => transaction.type === 'income')
    .reduce((sum, transaction) => sum + Number(transaction.amount), 0);
  const balance = totalIncome - totalExpense;

  const expensesByCategory = transactions
    .filter((transaction) => transaction.type === 'expense')
    .reduce((acc, transaction) => {
      acc[transaction.category] = (acc[transaction.category] || 0) + Number(transaction.amount);
      return acc;
    }, {});

  const chartData = Object.entries(expensesByCategory).map(([category, amount]) => ({
    category,
    amount,
    percent: totalExpense ? Math.round((amount / totalExpense) * 100) : 0
  }));

  const budget = getBudgetForUser(userId, monthKey);
  const budgetAmount = budget ? Number(budget.budgetAmount) : 0;
  const remaining = budgetAmount - totalExpense;

  res.json({
    month: monthKey,
    totalExpense,
    totalIncome,
    balance,
    expensesByCategory: chartData,
    budgetAmount,
    remaining,
    overBudget: remaining < 0 ? Math.abs(remaining) : 0
  });
});

app.get('/api/budget', requireAuth, (req, res) => {
  const userId = req.session.userId;
  const monthKey = getMonthKey();
  const budget = getBudgetForUser(userId, monthKey);
  res.json({ budget: budget ? Number(budget.budgetAmount) : 0 });
});

app.post('/api/budget', requireAuth, (req, res) => {
  const userId = req.session.userId;
  const monthKey = getMonthKey();
  const budgetAmount = Number(req.body.budgetAmount);

  if (!Number.isFinite(budgetAmount) || budgetAmount < 0) {
    return res.status(400).json({ error: '预算必须是非负数' });
  }

  saveBudgetForUser(userId, monthKey, budgetAmount);
  res.json({ message: '预算已更新', budgetAmount });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`记账本服务已启动，访问 http://localhost:${PORT}`);
  });
}

module.exports = app;
