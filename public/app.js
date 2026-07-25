const authPanel = document.getElementById('authPanel');
const dashboard = document.getElementById('dashboard');
const authArea = document.getElementById('authArea');

const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const transactionForm = document.getElementById('transactionForm');
const budgetInput = document.getElementById('budgetInput');
const saveBudgetBtn = document.getElementById('saveBudgetBtn');

const expenseValue = document.getElementById('expenseValue');
const incomeValue = document.getElementById('incomeValue');
const balanceValue = document.getElementById('balanceValue');
const categoryList = document.getElementById('categoryList');
const budgetValue = document.getElementById('budgetValue');
const spentValue = document.getElementById('spentValue');
const remainingValue = document.getElementById('remainingValue');
const budgetProgressFill = document.getElementById('budgetProgressFill');
const budgetStatusText = document.getElementById('budgetStatusText');
const budgetProgressPercent = document.getElementById('budgetProgressPercent');
const expenseChart = document.getElementById('expenseChart');
const transactionsBody = document.getElementById('transactionsBody');
const transactionTextInput = document.getElementById('transactionText');
const manualAmountInput = document.getElementById('manualAmount');
const transactionTypeSelect = document.getElementById('transactionType');
const transactionCategorySelect = document.getElementById('transactionCategory');
const customCategoryInput = document.getElementById('customCategory');
const previewAmount = document.getElementById('previewAmount');
const previewType = document.getElementById('previewType');
const previewCategory = document.getElementById('previewCategory');
const editModal = document.getElementById('editModal');
const closeEditModalBtn = document.getElementById('closeEditModal');
const editForm = document.getElementById('editForm');
const editAmountInput = document.getElementById('editAmount');
const editTypeSelect = document.getElementById('editType');
const editCategorySelect = document.getElementById('editCategory');
const editCustomCategoryInput = document.getElementById('editCustomCategory');
const editNoteInput = document.getElementById('editNote');
let currentEditId = null;

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || '请求失败');
  }
  return data;
}

async function checkAuth() {
  try {
    const result = await api('/api/me');
    showDashboard(result.user);
  } catch (error) {
    showDashboard({ username: '访客' });
  }
}

function showAuth() {
  authPanel.classList.add('hidden');
  dashboard.classList.remove('hidden');
  authArea.innerHTML = '<span>匿名使用</span>';
}

function showDashboard(user) {
  authPanel.classList.add('hidden');
  dashboard.classList.remove('hidden');
  authArea.innerHTML = `<span>欢迎，${user.username}</span>`;
  loadSummary();
  loadTransactions();
}

async function handleLogin(event) {
  event.preventDefault();
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;
  try {
    const result = await api('/api/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    showDashboard(result.user);
  } catch (error) {
    alert(error.message);
  }
}

async function handleRegister(event) {
  event.preventDefault();
  const username = document.getElementById('registerUsername').value.trim();
  const password = document.getElementById('registerPassword').value;
  try {
    const result = await api('/api/register', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    showDashboard(result.user);
  } catch (error) {
    alert(error.message);
  }
}

async function handleLogout() {
  try {
    await api('/api/logout', { method: 'POST' });
    showAuth();
  } catch (error) {
    showAuth();
  }
}

async function handleTransactionSubmit(event) {
  event.preventDefault();
  const text = transactionTextInput.value.trim();
  const type = transactionTypeSelect.value;
  const category = customCategoryInput.value.trim() ? '' : transactionCategorySelect.value;
  const amountValue = Number(manualAmountInput.value);

  if (!text) {
    alert('请输入记账内容');
    return;
  }

  if (!Number.isFinite(amountValue) || amountValue < 0) {
    alert('金额必须是非负数字');
    return;
  }

  try {
    await api('/api/transactions', {
      method: 'POST',
      body: JSON.stringify({ text, type, category, amount: amountValue, customCategory: customCategoryInput.value.trim() })
    });
    transactionTextInput.value = '';
    manualAmountInput.value = '';
    transactionTypeSelect.value = '';
    transactionCategorySelect.value = '';
    customCategoryInput.value = '';
    previewAmount.textContent = '-';
    previewType.textContent = '-';
    previewCategory.textContent = '-';
    loadSummary();
    loadTransactions();
  } catch (error) {
    alert(error.message);
  }
}

async function loadSummary() {
  try {
    const summary = await api('/api/summary');
    expenseValue.textContent = summary.totalExpense.toFixed(2);
    incomeValue.textContent = summary.totalIncome.toFixed(2);
    balanceValue.textContent = summary.balance.toFixed(2);
    budgetValue.textContent = summary.budgetAmount.toFixed(2);
    spentValue.textContent = summary.totalExpense.toFixed(2);
    remainingValue.textContent = (summary.remaining || 0).toFixed(2);

    const budgetAmount = Number(summary.budgetAmount || 0);
    const totalExpense = Number(summary.totalExpense || 0);
    const progressPercent = budgetAmount > 0 ? Math.min(100, (totalExpense / budgetAmount) * 100) : 0;
    budgetProgressFill.style.width = `${progressPercent}%`;
    budgetProgressPercent.textContent = `${Math.round(progressPercent)}%`;
    budgetStatusText.textContent = budgetAmount > 0
      ? (progressPercent >= 100 ? '预算已超支' : '本月预算使用进度')
      : '尚未设置预算';

    categoryList.innerHTML = '';
    expenseChart.innerHTML = '';
    if (summary.expensesByCategory.length === 0) {
      categoryList.innerHTML = '<li>暂无支出分类</li>';
      expenseChart.innerHTML = '<circle cx="50" cy="50" r="36" fill="none" stroke="#e7ece4" stroke-width="14"></circle><text x="50" y="54" text-anchor="middle" fill="#66707a" font-size="8">暂无数据</text>';
    } else {
      const palette = ['#2f9e44', '#55b96d', '#8dd7a8', '#3cb85a', '#1f7a35', '#94d3a1', '#65c26d', '#2d8d40'];
      const radius = 36;
      const circumference = 2 * Math.PI * radius;
      let offset = 0;

      const baseCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      baseCircle.setAttribute('cx', '50');
      baseCircle.setAttribute('cy', '50');
      baseCircle.setAttribute('r', radius);
      baseCircle.setAttribute('fill', 'none');
      baseCircle.setAttribute('stroke', '#e7ece4');
      baseCircle.setAttribute('stroke-width', '14');
      expenseChart.appendChild(baseCircle);

      summary.expensesByCategory.forEach((item, index) => {
        const length = (Number(item.amount) / totalExpense) * circumference;
        const segment = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        segment.setAttribute('cx', '50');
        segment.setAttribute('cy', '50');
        segment.setAttribute('r', radius);
        segment.setAttribute('fill', 'none');
        segment.setAttribute('stroke', palette[index % palette.length]);
        segment.setAttribute('stroke-width', '14');
        segment.setAttribute('stroke-linecap', 'round');
        segment.setAttribute('stroke-dasharray', `${length} ${circumference - length}`);
        segment.setAttribute('stroke-dashoffset', `${-offset}`);
        segment.setAttribute('transform', 'rotate(-90 50 50)');
        expenseChart.appendChild(segment);
        offset += length;

        const li = document.createElement('li');
        li.innerHTML = `<span>${item.category}</span><span>${item.amount.toFixed(2)} (${item.percent}%)</span>`;
        categoryList.appendChild(li);
      });

      const centerLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      centerLabel.setAttribute('x', '50');
      centerLabel.setAttribute('y', '50');
      centerLabel.setAttribute('text-anchor', 'middle');
      centerLabel.setAttribute('dominant-baseline', 'middle');
      centerLabel.setAttribute('fill', '#172026');
      centerLabel.setAttribute('font-size', '7');
      centerLabel.textContent = '总支出';
      expenseChart.appendChild(centerLabel);

      const centerValue = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      centerValue.setAttribute('x', '50');
      centerValue.setAttribute('y', '58');
      centerValue.setAttribute('text-anchor', 'middle');
      centerValue.setAttribute('dominant-baseline', 'middle');
      centerValue.setAttribute('fill', '#2f9e44');
      centerValue.setAttribute('font-size', '8');
      centerValue.setAttribute('font-weight', '700');
      centerValue.textContent = totalExpense.toFixed(0);
      expenseChart.appendChild(centerValue);
    }
  } catch (error) {
    console.error(error);
  }
}

async function loadTransactions() {
  try {
    const result = await api('/api/transactions');
    transactionsBody.innerHTML = '';
    if (!result.transactions.length) {
      transactionsBody.innerHTML = '<tr><td colspan="6">暂无记录</td></tr>';
      return;
    }

    result.transactions.forEach((transaction) => {
      const row = document.createElement('tr');
      const date = new Date(transaction.createdAt).toLocaleString('zh-CN');
      row.innerHTML = `
        <td>${date}</td>
        <td>${transaction.type === 'income' ? '收入' : '支出'}</td>
        <td>${transaction.category}</td>
        <td>${Number(transaction.amount).toFixed(2)}</td>
        <td>${transaction.note}</td>
        <td><button class="edit-btn" type="button" data-id="${transaction.id}">编辑</button></td>
      `;
      transactionsBody.appendChild(row);
    });

    document.querySelectorAll('.edit-btn').forEach((button) => {
      button.addEventListener('click', () => openEditModal(button.dataset.id));
    });
  } catch (error) {
    console.error(error);
  }
}

saveBudgetBtn.addEventListener('click', async () => {
  const budgetAmount = Number(budgetInput.value);
  if (!Number.isFinite(budgetAmount) || budgetAmount < 0) {
    alert('预算必须是非负数');
    return;
  }
  try {
    await api('/api/budget', {
      method: 'POST',
      body: JSON.stringify({ budgetAmount })
    });
    loadSummary();
  } catch (error) {
    alert(error.message);
  }
});

async function previewTransaction(text) {
  if (!text.trim()) {
    previewAmount.textContent = '-';
    previewType.textContent = '-';
    previewCategory.textContent = '-';
    return;
  }

  try {
    const result = await api('/api/parse', {
      method: 'POST',
      body: JSON.stringify({ text })
    });
    previewAmount.textContent = Number(result.amount).toFixed(2);
    previewType.textContent = result.type === 'income' ? '收入' : '支出';
    previewCategory.textContent = result.category || '其他';

    if (!transactionTypeSelect.value) {
      transactionTypeSelect.value = result.type;
    }
    if (!transactionCategorySelect.value) {
      transactionCategorySelect.value = result.category || '其他';
    }
    if (!manualAmountInput.value) {
      manualAmountInput.value = result.amount;
    }
  } catch (error) {
    console.error(error);
  }
}

transactionTextInput.addEventListener('input', (event) => {
  previewTransaction(event.target.value);
});

async function openEditModal(transactionId) {
  try {
    const result = await api('/api/transactions');
    const transaction = result.transactions.find((item) => item.id === transactionId);
    if (!transaction) {
      return;
    }

    currentEditId = transaction.id;
    editAmountInput.value = Number(transaction.amount).toFixed(2);
    editTypeSelect.value = transaction.type;
    editCategorySelect.value = transaction.category || '其他';
    editCustomCategoryInput.value = '';
    editNoteInput.value = transaction.note || '';
    editModal.classList.remove('hidden');
  } catch (error) {
    console.error(error);
  }
}

closeEditModalBtn.addEventListener('click', () => {
  editModal.classList.add('hidden');
  currentEditId = null;
});

editForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!currentEditId) {
    return;
  }

  const amountValue = Number(editAmountInput.value);
  if (!Number.isFinite(amountValue) || amountValue < 0) {
    alert('金额必须是非负数字');
    return;
  }

  try {
    await api(`/api/transactions/${currentEditId}`, {
      method: 'PUT',
      body: JSON.stringify({
        amount: amountValue,
        type: editTypeSelect.value,
        category: editCategorySelect.value,
        customCategory: editCustomCategoryInput.value.trim(),
        note: editNoteInput.value.trim()
      })
    });
    editModal.classList.add('hidden');
    loadSummary();
    loadTransactions();
  } catch (error) {
    alert(error.message);
  }
});

editModal.addEventListener('click', (event) => {
  if (event.target === editModal) {
    editModal.classList.add('hidden');
    currentEditId = null;
  }
});

loginForm.addEventListener('submit', handleLogin);
registerForm.addEventListener('submit', handleRegister);
transactionForm.addEventListener('submit', handleTransactionSubmit);

checkAuth();
