// ============================================================
// InvoiceGen - Invoice Generator Application
// Local Storage Auth + Data Persistence
// jsPDF for PDF generation
// ============================================================

// ============================================================
// FIREBASE CONFIG
// ============================================================
const firebaseConfig = {
  apiKey: "AIzaSyDewhhFxAqpTf__mRVaEWQCtqUQcaI4_iU",
  authDomain: "novabill-69a68.firebaseapp.com",
  projectId: "novabill-69a68",
  storageBucket: "novabill-69a68.firebasestorage.app",
  messagingSenderId: "312479977755",
  appId: "1:312479977755:web:fea8bbccb1a8fdd577c3be",
  measurementId: "G-VZ00FLLLH7"
};

let db_firebase = null;
let auth_firebase = null;

// ============================================================
// STATE
// ============================================================
let currentUser = null;
let currentInvoiceId = null;
let allInvoices = [];
let allClients = [];
let userSettings = null;
let logoDataUrl = null;
let confirmCallback = null;

// ============================================================
// LOCAL STORAGE HELPERS
// ============================================================
const DB_KEY = 'invoicegen_db';

function getDB() {
  try {
    return JSON.parse(localStorage.getItem(DB_KEY)) || { users: [], invoices: [], clients: [], settings: [] };
  } catch {
    return { users: [], invoices: [], clients: [], settings: [] };
  }
}

function saveDB(db) {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}

function generateId() {
  return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 10);
}

function nowTimestamp() {
  return new Date().toISOString();
}

// ============================================================
// FIREBASE AUTH
// ============================================================
function initFirebase() {
  if (typeof firebase === 'undefined') {
    console.error('Firebase SDK not loaded');
    showAuth();
    return;
  }
  firebase.initializeApp(firebaseConfig);

  // Listen for auth state changes
  firebase.auth().onAuthStateChanged(async (user) => {
    if (user) {
      // User is signed in
      const db = getDB();
      // Find existing user data or create new
      let userData = db.users.find(u => u.id === user.uid);
      if (!userData) {
        // Create user record from Firebase
        userData = {
          id: user.uid,
          name: user.displayName || user.email.split('@')[0] || 'User',
          email: user.email,
          createdAt: nowTimestamp()
        };
        db.users.push(userData);
        // Create default settings
        db.settings.push({
          id: generateId(),
          userId: user.uid,
          companyName: userData.name,
          companyEmail: user.email,
          companyPhone: '',
          companyAddress: '',
          companyCity: '',
          companyStateZip: '',
          companyCountry: '',
          currency: 'USD',
          createdAt: nowTimestamp()
        });
        saveDB(db);
      }
      currentUser = userData;
      showApp();
      loadUserData();
    } else {
      // User is signed out
      currentUser = null;
      allInvoices = [];
      allClients = [];
      userSettings = null;
      showAuth();
    }
  });
}

function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim().toLowerCase();
  const password = document.getElementById('login-password').value;
  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.textContent = 'Signing in...';

  firebase.auth().signInWithEmailAndPassword(email, password)
    .then((userCredential) => {
      // Sign-in successful - onAuthStateChanged handles the rest
      showToast('✅ Welcome back!', 'success');
      e.target.reset();
    })
    .catch((error) => {
      showToast(getAuthErrorMessage(error.code), 'error');
    })
    .finally(() => {
      btn.disabled = false;
      btn.textContent = 'Sign In';
    });
}

function handleSignup(e) {
  e.preventDefault();
  const name = document.getElementById('signup-name').value.trim();
  const email = document.getElementById('signup-email').value.trim().toLowerCase();
  const password = document.getElementById('signup-password').value;
  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.textContent = 'Creating account...';

  if (!name) {
    showToast('Please enter your full name', 'error');
    btn.disabled = false;
    btn.textContent = 'Create Account';
    return;
  }
  if (!email || !email.includes('@')) {
    showToast('Please enter a valid email address.', 'error');
    btn.disabled = false;
    btn.textContent = 'Create Account';
    return;
  }
  if (password.length < 6) {
    showToast('Password should be at least 6 characters.', 'error');
    btn.disabled = false;
    btn.textContent = 'Create Account';
    return;
  }

  firebase.auth().createUserWithEmailAndPassword(email, password)
    .then((userCredential) => {
      // Update display name
      return userCredential.user.updateProfile({ displayName: name })
        .then(() => userCredential);
    })
    .then((userCredential) => {
      // Store name in localStorage for reference
      localStorage.setItem('invoicegen_display_name', name);
      showToast('✅ Account created! Welcome to InvoiceGen!', 'success');
      e.target.reset();
    })
    .catch((error) => {
      showToast(getAuthErrorMessage(error.code), 'error');
    })
    .finally(() => {
      btn.disabled = false;
      btn.textContent = 'Create Account';
    });
}

function handleLogout() {
  firebase.auth().signOut().then(() => {
    localStorage.removeItem('invoicegen_session');
    showToast('👋 Logged out successfully', 'success');
  }).catch((error) => {
    showToast('Logout failed: ' + error.message, 'error');
  });
}

function getAuthErrorMessage(code) {
  const messages = {
    'auth/user-not-found': 'No account found with this email.',
    'auth/wrong-password': 'Incorrect password. Please try again.',
    'auth/invalid-credential': 'Invalid email or password.',
    'auth/email-already-in-use': 'An account with this email already exists.',
    'auth/weak-password': 'Password should be at least 6 characters.',
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/too-many-requests': 'Too many attempts. Please try again later.',
    'auth/network-request-failed': 'Network error. Check your connection.',
    'auth/operation-not-allowed': 'This operation is not allowed.',
    'auth/user-disabled': 'This account has been disabled.',
    'auth/configuration-not-found': 'Email/Password sign-in is not enabled. Please enable it in Firebase Console → Authentication → Sign-in method.',
  };
  return messages[code] || 'Authentication error: ' + code;
}

// ============================================================
// VIEW MANAGEMENT
// ============================================================
function showAuth() {
  document.getElementById('auth-view').classList.remove('hidden');
  document.getElementById('app-view').classList.add('hidden');
  document.getElementById('app-view').classList.remove('flex');
}

function showApp() {
  document.getElementById('auth-view').classList.add('hidden');
  document.getElementById('app-view').classList.remove('hidden');
  document.getElementById('app-view').classList.add('flex');
  // Set user info
  const name = currentUser?.name || 'User';
  document.getElementById('sidebar-user-name').textContent = name;
  const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  document.getElementById('topbar-avatar').textContent = initials || 'U';
}

function showSignup() {
  document.getElementById('login-form').classList.add('hidden');
  document.getElementById('signup-form').classList.remove('hidden');
}

function showLogin() {
  document.getElementById('signup-form').classList.add('hidden');
  document.getElementById('login-form').classList.remove('hidden');
}

function showView(view) {
  // Hide all views
  document.querySelectorAll('.view-section').forEach(s => s.classList.add('hidden'));

  // Show selected view
  const viewMap = {
    dashboard: 'dashboard-view',
    invoices: 'invoices-view',
    editor: 'editor-view',
    clients: 'clients-view',
    settings: 'settings-view',
  };

  const el = document.getElementById(viewMap[view]);
  if (el) el.classList.remove('hidden');

  // Update page title
  const titles = {
    dashboard: 'Dashboard',
    invoices: 'Invoices',
    editor: currentInvoiceId ? 'Edit Invoice' : 'New Invoice',
    clients: 'Clients',
    settings: 'Settings',
  };
  document.getElementById('page-title').textContent = titles[view] || 'Dashboard';

  // Update nav active state
  document.querySelectorAll('.nav-btn').forEach(b => {
    b.classList.remove('bg-gray-800', 'text-white');
    if (b.dataset.view === view) {
      b.classList.add('bg-gray-800', 'text-white');
    }
  });

  // Close sidebar on mobile
  document.getElementById('sidebar').classList.add('-translate-x-full');
  document.getElementById('sidebar-overlay').classList.add('hidden');

  // Load data for view
  if (view === 'dashboard') loadDashboard();
  if (view === 'invoices') renderInvoicesTable();
  if (view === 'clients') renderClientsGrid();
  if (view === 'settings') loadSettingsIntoForm();
}

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  sidebar.classList.toggle('-translate-x-full');
  overlay.classList.toggle('hidden');
}

// ============================================================
// DATA LOADING (Local Storage)
// ============================================================
async function loadUserData() {
  if (!currentUser) return;
  try {
    await Promise.all([loadInvoices(), loadClients(), loadSettings()]);
    loadDashboard();
    renderInvoicesTable();
    renderClientsGrid();
    loadClientSelect();
    loadSettingsIntoEditor();
    loadSettingsIntoForm();
  } catch (error) {
    console.error('Error loading user data:', error);
    showToast('Error loading data: ' + error.message, 'error');
  }
}

async function loadInvoices() {
  if (!currentUser) return;
  try {
    const db = getDB();
    allInvoices = db.invoices
      .filter(inv => inv.userId === currentUser.id)
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    // Update nav count
    const countEl = document.getElementById('nav-invoice-count');
    if (allInvoices.length > 0) {
      countEl.textContent = allInvoices.length;
      countEl.classList.remove('hidden');
    } else {
      countEl.classList.add('hidden');
    }
  } catch (error) {
    console.error('Error loading invoices:', error);
  }
}

async function loadClients() {
  if (!currentUser) return;
  try {
    const db = getDB();
    allClients = db.clients
      .filter(c => c.userId === currentUser.id)
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  } catch (error) {
    console.error('Error loading clients:', error);
  }
}

async function loadSettings() {
  if (!currentUser) return;
  try {
    const db = getDB();
    const settings = db.settings.filter(s => s.userId === currentUser.id);
    if (settings.length > 0) {
      userSettings = settings[0];
    } else {
      userSettings = null;
    }
  } catch (error) {
    console.error('Error loading settings:', error);
  }
}

// ============================================================
// DASHBOARD
// ============================================================
function loadDashboard() {
  if (!allInvoices.length && !allClients.length) {
    document.getElementById('stat-total-invoices').textContent = '0';
    document.getElementById('stat-total-revenue').textContent = '$0.00';
    document.getElementById('stat-outstanding').textContent = '$0.00';
    document.getElementById('stat-total-clients').textContent = '0';
    renderRecentInvoices();
    return;
  }
  const totalInvoices = allInvoices.length;
  const totalRevenue = allInvoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + (i.total || 0), 0);
  const outstanding = allInvoices.filter(i => i.status === 'sent' || i.status === 'overdue').reduce((sum, i) => sum + (i.total || 0), 0);
  const totalClients = allClients.length;

  const currency = userSettings?.currency || 'USD';
  const fmt = (v) => formatCurrency(v, currency);

  document.getElementById('stat-total-invoices').textContent = totalInvoices;

  document.getElementById('stat-total-revenue').textContent = fmt(totalRevenue);
  document.getElementById('stat-outstanding').textContent = fmt(outstanding);
  document.getElementById('stat-total-clients').textContent = totalClients;

  renderRecentInvoices();
}

function renderRecentInvoices() {
  const container = document.getElementById('recent-invoices-list');
  const recent = allInvoices.slice(0, 5);

  if (!recent.length) {
    container.innerHTML = '<div class="p-8 text-center text-gray-400 text-sm">No invoices yet. Click "New Invoice" to get started.</div>';
    return;
  }

  const currency = userSettings?.currency || 'USD';

  container.innerHTML = recent.map(inv => {
    const statusColors = {
      draft: 'bg-gray-100 text-gray-600',
      sent: 'bg-blue-100 text-blue-600',
      paid: 'bg-green-100 text-green-600',
      overdue: 'bg-red-100 text-red-600',
    };
    const statusColor = statusColors[inv.status] || 'bg-gray-100 text-gray-600';
    const clientName = inv.toName || 'Unknown Client';

    return `
      <div class="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg transition cursor-pointer" onclick="openInvoice('${inv.id}')">
        <div class="w-9 h-9 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center text-sm font-bold">${clientName.charAt(0).toUpperCase()}</div>
        <div class="flex-1 min-w-0">
          <p class="font-medium text-gray-900 text-sm truncate">${escapeHtml(inv.number || 'INV')}</p>
          <p class="text-xs text-gray-500 truncate">${escapeHtml(clientName)}</p>
        </div>
        <div class="text-right">
          <p class="font-semibold text-gray-900 text-sm">${formatCurrency(inv.total || 0, currency)}</p>
          <span class="inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusColor}">${inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}</span>
        </div>
      </div>
    `;
  }).join('');
}

// ============================================================
// INVOICES TABLE
// ============================================================
function renderInvoicesTable() {
  const tbody = document.getElementById('invoices-table-body');
  const search = document.getElementById('invoice-search').value.toLowerCase();
  const statusFilter = document.getElementById('invoice-status-filter').value;

  let filtered = allInvoices;

  if (search) {
    filtered = filtered.filter(inv =>
      (inv.number || '').toLowerCase().includes(search) ||
      (inv.toName || '').toLowerCase().includes(search) ||
      (inv.toEmail || '').toLowerCase().includes(search)
    );
  }

  if (statusFilter) {
    filtered = filtered.filter(inv => inv.status === statusFilter);
  }

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="px-5 py-10 text-center text-gray-400">No invoices found.</td></tr>`;
    return;
  }

  const currency = userSettings?.currency || 'USD';

  tbody.innerHTML = filtered.map(inv => {
    const statusColors = {
      draft: 'bg-gray-100 text-gray-600',
      sent: 'bg-blue-100 text-blue-600',
      paid: 'bg-green-100 text-green-600',
      overdue: 'bg-red-100 text-red-600',
    };
    const statusColor = statusColors[inv.status] || 'bg-gray-100 text-gray-600';
    const date = inv.date ? formatDate(inv.date) : '—';
    const dueDate = inv.dueDate ? formatDate(inv.dueDate) : '—';

    return `
      <tr class="border-t border-gray-100 hover:bg-gray-50 transition">
        <td class="px-5 py-3 font-medium text-indigo-600">${escapeHtml(inv.number || 'INV')}</td>
        <td class="px-5 py-3">
          <p class="font-medium text-gray-900">${escapeHtml(inv.toName || 'Unknown')}</p>
          <p class="text-xs text-gray-500">${escapeHtml(inv.toEmail || '')}</p>
        </td>
        <td class="px-5 py-3 text-gray-600">${date}</td>
        <td class="px-5 py-3 text-gray-600">${dueDate}</td>
        <td class="px-5 py-3 font-semibold text-gray-900">${formatCurrency(inv.total || 0, currency)}</td>
        <td class="px-5 py-3">
          <span class="inline-block px-2.5 py-1 rounded-full text-xs font-medium ${statusColor}">${inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}</span>
        </td>
        <td class="px-5 py-3">
          <div class="flex items-center justify-end gap-1">
            <button onclick="openInvoice('${inv.id}')" class="p-1.5 text-gray-400 hover:text-indigo-600 transition" title="Edit">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
            </button>
            <button onclick="previewInvoice('${inv.id}')" class="p-1.5 text-gray-400 hover:text-blue-600 transition" title="Preview">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
            </button>
            ${inv.status !== 'paid' ? `
            <button onclick="markInvoiceAsPaid('${inv.id}')" class="p-1.5 text-gray-400 hover:text-green-600 transition" title="Mark as Paid">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 9 9 0 0118 0z"/></svg>
            </button>
            ` : ''}
            <button onclick="deleteInvoice('${inv.id}')" class="p-1.5 text-gray-400 hover:text-red-600 transition" title="Delete">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// ============================================================
// INVOICE EDITOR
// ============================================================
function openNewInvoice() {
  currentInvoiceId = null;
  logoDataUrl = null;
  document.getElementById('editor-title').textContent = 'New Invoice';
  document.getElementById('inv-number').value = generateInvoiceNumber();

  const today = new Date();
  document.getElementById('inv-date').value = formatDateInput(today);
  const dueDate = new Date(today);
  dueDate.setDate(dueDate.getDate() + 30);
  document.getElementById('inv-due-date').value = formatDateInput(dueDate);

  document.getElementById('inv-status').value = 'draft';
  document.getElementById('from-name').value = userSettings?.companyName || '';
  document.getElementById('from-email').value = userSettings?.companyEmail || '';
  document.getElementById('from-phone').value = userSettings?.companyPhone || '';
  document.getElementById('from-address').value = userSettings?.companyAddress || '';
  document.getElementById('from-city').value = userSettings?.companyCity || '';
  document.getElementById('from-state-zip').value = userSettings?.companyStateZip || '';
  document.getElementById('from-country').value = userSettings?.companyCountry || '';
  document.getElementById('from-logo').value = '';
  document.getElementById('to-name').value = '';
  document.getElementById('to-email').value = '';
  document.getElementById('to-phone').value = '';
  document.getElementById('to-address').value = '';
  document.getElementById('to-city').value = '';
  document.getElementById('to-state-zip').value = '';
  document.getElementById('to-country').value = '';
  document.getElementById('save-client-checkbox').checked = false;
  document.getElementById('inv-notes').value = '';
  document.getElementById('inv-terms').value = 'Payment due within 30 days.';
  document.getElementById('discount-type').value = 'percentage';
  document.getElementById('discount-value').value = '0';
  document.getElementById('shipping-cost').value = '0';
  document.getElementById('inv-currency').value = userSettings?.currency || 'USD';
  document.getElementById('client-select').value = '';

  // Reset items
  document.getElementById('items-table-body').innerHTML = '';
  addItemRow();
  addItemRow();

  calculateTotals();
  showView('editor');
}

async function openInvoice(id) {
  try {
    const inv = allInvoices.find(i => i.id === id);
    if (!inv) {
      showToast('Invoice not found', 'error');
      return;
    }

    if (inv.userId !== currentUser.id) {
      showToast('You do not have access to this invoice', 'error');
      return;
    }

    currentInvoiceId = id;
    logoDataUrl = inv.logoDataUrl || null;

    document.getElementById('editor-title').textContent = 'Edit Invoice';
    document.getElementById('inv-number').value = inv.number || '';
    document.getElementById('inv-date').value = inv.date || '';
    document.getElementById('inv-due-date').value = inv.dueDate || '';
    document.getElementById('inv-status').value = inv.status || 'draft';

    document.getElementById('from-name').value = inv.fromName || '';
    document.getElementById('from-email').value = inv.fromEmail || '';
    document.getElementById('from-phone').value = inv.fromPhone || '';
    document.getElementById('from-address').value = inv.fromAddress || '';
    document.getElementById('from-city').value = inv.fromCity || '';
    document.getElementById('from-state-zip').value = inv.fromStateZip || '';
    document.getElementById('from-country').value = inv.fromCountry || '';
    document.getElementById('from-logo').value = inv.fromLogo || '';

    document.getElementById('to-name').value = inv.toName || '';
    document.getElementById('to-email').value = inv.toEmail || '';
    document.getElementById('to-phone').value = inv.toPhone || '';
    document.getElementById('to-address').value = inv.toAddress || '';
    document.getElementById('to-city').value = inv.toCity || '';
    document.getElementById('to-state-zip').value = inv.toStateZip || '';
    document.getElementById('to-country').value = inv.toCountry || '';

    document.getElementById('inv-notes').value = inv.notes || '';
    document.getElementById('inv-terms').value = inv.terms || '';
    document.getElementById('discount-type').value = inv.discountType || 'percentage';
    document.getElementById('discount-value').value = inv.discountValue || 0;
    document.getElementById('shipping-cost').value = inv.shippingCost || 0;
    document.getElementById('inv-currency').value = inv.currency || 'USD';

    // Load items
    const itemsBody = document.getElementById('items-table-body');
    itemsBody.innerHTML = '';
    if (inv.items && inv.items.length) {
      inv.items.forEach(item => addItemRow(item));
    } else {
      addItemRow();
      addItemRow();
    }

    calculateTotals();
    showView('editor');
  } catch (error) {
    console.error('Error opening invoice:', error);
    showToast('Error opening invoice: ' + error.message, 'error');
  }
}

function addItemRow(item = {}) {
  const tbody = document.getElementById('items-table-body');
  const tr = document.createElement('tr');
  tr.className = 'border-t border-gray-100';
  tr.innerHTML = `
    <td class="px-3 py-2">
      <input type="text" class="item-desc w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" placeholder="Description of item or service" value="${escapeAttr(item.description || '')}">
    </td>
    <td class="px-3 py-2">
      <input type="number" class="item-qty w-full px-2 py-2 border border-gray-300 rounded-lg text-sm text-center focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" min="0" step="1" value="${item.quantity || 1}">
    </td>
    <td class="px-3 py-2">
      <input type="number" class="item-price w-full px-2 py-2 border border-gray-300 rounded-lg text-sm text-right focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" min="0" step="0.01" value="${item.unitPrice || 0}">
    </td>
    <td class="px-3 py-2">
      <input type="number" class="item-tax w-full px-2 py-2 border border-gray-300 rounded-lg text-sm text-right focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" min="0" step="0.01" value="${item.taxRate || 0}">
    </td>
    <td class="px-3 py-2 text-right">
      <span class="item-amount font-semibold text-gray-900 text-sm">$0.00</span>
    </td>
    <td class="px-3 py-2 text-center">
      <button onclick="this.closest('tr').remove(); calculateTotals();" class="p-1 text-gray-300 hover:text-red-500 transition" title="Remove item">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
      </button>
    </td>
  `;

  // Bind input events
  tr.querySelectorAll('input').forEach(input => {
    input.addEventListener('input', calculateTotals);
  });

  tbody.appendChild(tr);
  calculateTotals();
}

function bindItemEvents() {
  // Event delegation for dynamically added items
  document.getElementById('items-table-body').addEventListener('input', (e) => {
    if (e.target.classList.contains('item-desc') ||
        e.target.classList.contains('item-qty') ||
        e.target.classList.contains('item-price') ||
        e.target.classList.contains('item-tax')) {
      calculateTotals();
    }
  });
}

function getItems() {
  const rows = document.querySelectorAll('#items-table-body tr');
  const items = [];
  rows.forEach(row => {
    const desc = row.querySelector('.item-desc').value.trim();
    const qty = parseFloat(row.querySelector('.item-qty').value) || 0;
    const price = parseFloat(row.querySelector('.item-price').value) || 0;
    const tax = parseFloat(row.querySelector('.item-tax').value) || 0;

    if (desc || qty > 0 || price > 0) {
      items.push({
        description: desc,
        quantity: qty,
        unitPrice: price,
        taxRate: tax,
        amount: qty * price,
        taxAmount: (qty * price) * (tax / 100),
        total: (qty * price) + ((qty * price) * (tax / 100))
      });
    }
  });
  return items;
}

function calculateTotals() {
  const items = getItems();
  const subtotal = items.reduce((sum, i) => sum + i.amount, 0);
  const taxTotal = items.reduce((sum, i) => sum + i.taxAmount, 0);

  const discountType = document.getElementById('discount-type').value;
  const discountValue = parseFloat(document.getElementById('discount-value').value) || 0;
  let discountAmount = 0;
  if (discountType === 'percentage') {
    discountAmount = (subtotal * discountValue) / 100;
  } else {
    discountAmount = Math.min(discountValue, subtotal);
  }

  const shipping = parseFloat(document.getElementById('shipping-cost').value) || 0;
  const total = Math.max(0, subtotal - discountAmount + taxTotal + shipping);

  const currency = document.getElementById('inv-currency').value;

  document.getElementById('calc-subtotal').textContent = formatCurrency(subtotal, currency);
  document.getElementById('calc-tax').textContent = formatCurrency(taxTotal, currency);
  document.getElementById('calc-total').textContent = formatCurrency(total, currency);

  // Update item amounts
  const rows = document.querySelectorAll('#items-table-body tr');
  rows.forEach((row, index) => {
    const item = items[index];
    const amountEl = row.querySelector('.item-amount');
    if (item) {
      amountEl.textContent = formatCurrency(item.total, currency);
    } else {
      amountEl.textContent = formatCurrency(0, currency);
    }
  });
}

// ============================================================
// INVOICE SAVE / DELETE
// ============================================================
async function saveInvoice(status) {
  if (!currentUser) return;

  const toName = document.getElementById('to-name').value.trim();
  if (!toName) {
    showToast('Please enter a client name', 'error');
    document.getElementById('to-name').focus();
    return;
  }

  const items = getItems();
  if (!items.length) {
    showToast('Please add at least one item', 'error');
    return;
  }

  const subtotal = items.reduce((sum, i) => sum + i.amount, 0);
  const taxTotal = items.reduce((sum, i) => sum + i.taxAmount, 0);
  const discountType = document.getElementById('discount-type').value;
  const discountValue = parseFloat(document.getElementById('discount-value').value) || 0;
  let discountAmount = 0;
  if (discountType === 'percentage') {
    discountAmount = (subtotal * discountValue) / 100;
  } else {
    discountAmount = Math.min(discountValue, subtotal);
  }
  const shipping = parseFloat(document.getElementById('shipping-cost').value) || 0;
  const total = Math.max(0, subtotal - discountAmount + taxTotal + shipping);

  const invoiceData = {
    userId: currentUser.id,
    number: document.getElementById('inv-number').value.trim() || generateInvoiceNumber(),
    date: document.getElementById('inv-date').value,
    dueDate: document.getElementById('inv-due-date').value,
    status: status || document.getElementById('inv-status').value,

    fromName: document.getElementById('from-name').value.trim(),
    fromEmail: document.getElementById('from-email').value.trim(),
    fromPhone: document.getElementById('from-phone').value.trim(),
    fromAddress: document.getElementById('from-address').value.trim(),
    fromCity: document.getElementById('from-city').value.trim(),
    fromStateZip: document.getElementById('from-state-zip').value.trim(),
    fromCountry: document.getElementById('from-country').value.trim(),
    fromLogo: document.getElementById('from-logo').value.trim(),
    logoDataUrl: logoDataUrl,

    toName: toName,
    toEmail: document.getElementById('to-email').value.trim(),
    toPhone: document.getElementById('to-phone').value.trim(),
    toAddress: document.getElementById('to-address').value.trim(),
    toCity: document.getElementById('to-city').value.trim(),
    toStateZip: document.getElementById('to-state-zip').value.trim(),
    toCountry: document.getElementById('to-country').value.trim(),

    items: items,
    subtotal: subtotal,
    taxTotal: taxTotal,
    discountType: discountType,
    discountValue: discountValue,
    discountAmount: discountAmount,
    shippingCost: shipping,
    total: total,
    currency: document.getElementById('inv-currency').value,

    notes: document.getElementById('inv-notes').value.trim(),
    terms: document.getElementById('inv-terms').value.trim(),

    updatedAt: nowTimestamp()
  };

  try {
    const db = getDB();

    if (currentInvoiceId) {
      // Update existing invoice
      const idx = db.invoices.findIndex(i => i.id === currentInvoiceId);
      if (idx >= 0) {
        db.invoices[idx] = { ...db.invoices[idx], ...invoiceData };
        showToast('✅ Invoice updated successfully', 'success');
      }
    } else {
      // Create new invoice
      invoiceData.id = generateId();
      invoiceData.createdAt = nowTimestamp();
      db.invoices.push(invoiceData);
      currentInvoiceId = invoiceData.id;
      showToast('✅ Invoice saved successfully', 'success');
    }

    // Save client if checkbox checked
    const saveClient = document.getElementById('save-client-checkbox').checked;
    if (saveClient && toName) {
      await saveClientFromInvoice({
        name: toName,
        email: document.getElementById('to-email').value.trim(),
        phone: document.getElementById('to-phone').value.trim(),
        address: document.getElementById('to-address').value.trim(),
        city: document.getElementById('to-city').value.trim(),
        stateZip: document.getElementById('to-state-zip').value.trim(),
        country: document.getElementById('to-country').value.trim(),
      });
    }

    saveDB(db);

    await loadInvoices();
    await loadClients();
    loadClientSelect();
    renderInvoicesTable();
    loadDashboard();

    if (status === 'sent') {
      showView('invoices');
    }
  } catch (error) {
    console.error('Error saving invoice:', error);
    showToast('Error saving invoice: ' + error.message, 'error');
  }
}

async function markInvoiceAsPaid(id) {
  const inv = allInvoices.find(i => i.id === id);
  if (!inv) {
    showToast('Invoice not found', 'error');
    return;
  }

  showConfirmModal(
    'Mark as Paid?',
    `Mark invoice ${inv.number || ''} as paid?`,
    async () => {
      try {
        const db = getDB();
        const idx = db.invoices.findIndex(i => i.id === id);
        if (idx >= 0) {
          db.invoices[idx].status = 'paid';
          db.invoices[idx].paidAt = nowTimestamp();
          db.invoices[idx].updatedAt = nowTimestamp();
          saveDB(db);
          await loadInvoices();
          renderInvoicesTable();
          loadDashboard();
          showToast('✅ Invoice marked as paid', 'success');
        }
      } catch (error) {
        console.error('Error marking invoice as paid:', error);
        showToast('Error marking invoice as paid: ' + error.message, 'error');
      }
    }
  );
}

async function markCurrentInvoiceAsPaid() {
  if (!currentInvoiceId) {
    // Save the invoice first
    await saveInvoice('paid');
    return;
  }

  const inv = allInvoices.find(i => i.id === currentInvoiceId);
  if (!inv) {
    showToast('Invoice not found', 'error');
    return;
  }

  showConfirmModal(
    'Mark as Paid?',
    `Mark invoice ${inv.number || ''} as paid?`,
    async () => {
      try {
        const db = getDB();
        const idx = db.invoices.findIndex(i => i.id === currentInvoiceId);
        if (idx >= 0) {
          db.invoices[idx].status = 'paid';
          db.invoices[idx].paidAt = nowTimestamp();
          db.invoices[idx].updatedAt = nowTimestamp();
          saveDB(db);
          await loadInvoices();
          renderInvoicesTable();
          loadDashboard();
          showToast('✅ Invoice marked as paid', 'success');
        }
      } catch (error) {
        console.error('Error marking invoice as paid:', error);
        showToast('Error marking invoice as paid: ' + error.message, 'error');
      }
    }
  );
}

async function deleteInvoice(id) {
  showConfirmModal(
    'Delete Invoice?',
    'This invoice will be permanently deleted. This action cannot be undone.',
    async () => {
      try {
        const db = getDB();
        db.invoices = db.invoices.filter(i => i.id !== id);
        saveDB(db);
        await loadInvoices();
        renderInvoicesTable();
        loadDashboard();
        showToast('🗑️ Invoice deleted', 'success');
      } catch (error) {
        console.error('Error deleting invoice:', error);
        showToast('Error deleting invoice: ' + error.message, 'error');
      }
    }
  );
}

function generateInvoiceNumber() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `INV-${y}${m}${d}-${rand}`;
}

// ============================================================
// CLIENTS
// ============================================================
function renderClientsGrid() {
  const grid = document.getElementById('clients-grid');

  if (!allClients.length) {
    grid.innerHTML = '<div class="p-10 text-center text-gray-400 text-sm col-span-full">No clients yet. Add your first client to get started.</div>';
    return;
  }

  grid.innerHTML = allClients.map(client => {
    const initials = (client.name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    return `
      <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition">
        <div class="flex items-start justify-between">
          <div class="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center font-bold text-lg">${escapeHtml(initials)}</div>
          <div class="flex gap-1">
            <button onclick="editClient('${client.id}')" class="p-1.5 text-gray-400 hover:text-indigo-600 transition" title="Edit">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
            </button>
            <button onclick="deleteClient('${client.id}')" class="p-1.5 text-gray-400 hover:text-red-600 transition" title="Delete">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </button>
          </div>
        </div>
        <h3 class="font-semibold text-gray-900 mt-3">${escapeHtml(client.name)}</h3>
        ${client.email ? `<p class="text-sm text-gray-500 truncate">${escapeHtml(client.email)}</p>` : ''}
        ${client.phone ? `<p class="text-sm text-gray-500">${escapeHtml(client.phone)}</p>` : ''}
        ${client.city ? `<p class="text-sm text-gray-400 mt-1">${escapeHtml(client.city)}${client.country ? ', ' + escapeHtml(client.country) : ''}</p>` : ''}
        <div class="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
          <span class="text-xs text-gray-400">${client.invoiceCount || 0} invoices</span>
          <button onclick="useClientInInvoice('${client.id}')" class="text-xs text-indigo-600 font-medium hover:underline">Use in Invoice →</button>
        </div>
      </div>
    `;
  }).join('');
}

function openClientModal(client = null) {
  document.getElementById('client-modal-title').textContent = client ? 'Edit Client' : 'Add Client';
  document.getElementById('client-id').value = client?.id || '';
  document.getElementById('client-name').value = client?.name || '';
  document.getElementById('client-email').value = client?.email || '';
  document.getElementById('client-phone').value = client?.phone || '';
  document.getElementById('client-address').value = client?.address || '';
  document.getElementById('client-city').value = client?.city || '';
  document.getElementById('client-state-zip').value = client?.stateZip || '';
  document.getElementById('client-country').value = client?.country || '';

  const modal = document.getElementById('client-modal');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function closeClientModal() {
  const modal = document.getElementById('client-modal');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

function editClient(id) {
  const client = allClients.find(c => c.id === id);
  if (client) openClientModal(client);
}

async function deleteClient(id) {
  showConfirmModal(
    'Delete Client?',
    'This client will be removed from your saved clients.',
    async () => {
      try {
        const db = getDB();
        db.clients = db.clients.filter(c => c.id !== id);
        saveDB(db);
        await loadClients();
        renderClientsGrid();
        loadClientSelect();
        loadDashboard();
        showToast('🗑️ Client deleted', 'success');
      } catch (error) {
        console.error('Error deleting client:', error);
        showToast('Error deleting client: ' + error.message, 'error');
      }
    }
  );
}

async function handleClientFormSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('client-id').value;
  const name = document.getElementById('client-name').value.trim();
  if (!name) {
    showToast('Please enter a client name', 'error');
    return;
  }
  const clientData = {
    userId: currentUser.id,
    name: name,
    email: document.getElementById('client-email').value.trim(),
    phone: document.getElementById('client-phone').value.trim(),
    address: document.getElementById('client-address').value.trim(),
    city: document.getElementById('client-city').value.trim(),
    stateZip: document.getElementById('client-state-zip').value.trim(),
    country: document.getElementById('client-country').value.trim(),
    updatedAt: nowTimestamp()
  };

  try {
    const db = getDB();

    if (id) {
      const idx = db.clients.findIndex(c => c.id === id);
      if (idx >= 0) {
        db.clients[idx] = { ...db.clients[idx], ...clientData };
        showToast('✅ Client updated successfully', 'success');
      }
    } else {
      clientData.id = generateId();
      clientData.createdAt = nowTimestamp();
      db.clients.push(clientData);
      showToast('✅ Client added successfully', 'success');
    }

    saveDB(db);
    closeClientModal();
    e.target.reset();
    await loadClients();
    renderClientsGrid();
    loadClientSelect();
    loadDashboard();
  } catch (error) {
    console.error('Error saving client:', error);
    showToast('Error saving client: ' + error.message, 'error');
  }
}

async function saveClientFromInvoice(clientData) {
  try {
    const db = getDB();
    // Check if client already exists with same email or name
    const existing = allClients.find(c =>
      (c.email && clientData.email && c.email.toLowerCase() === clientData.email.toLowerCase()) ||
      (c.name.toLowerCase() === clientData.name.toLowerCase())
    );

    if (existing) {
      // Update existing client
      const idx = db.clients.findIndex(c => c.id === existing.id);
      if (idx >= 0) {
        db.clients[idx] = { ...db.clients[idx], ...clientData, updatedAt: nowTimestamp() };
      }
    } else {
      db.clients.push({
        ...clientData,
        id: generateId(),
        userId: currentUser.id,
        createdAt: nowTimestamp(),
        updatedAt: nowTimestamp()
      });
    }
    saveDB(db);
  } catch (error) {
    console.error('Error saving client from invoice:', error);
  }
}

function loadClientSelect() {
  const select = document.getElementById('client-select');
  const currentVal = select.value;
  select.innerHTML = '<option value="">Select saved client...</option>';
  allClients.forEach(client => {
    const opt = document.createElement('option');
    opt.value = client.id;
    opt.textContent = client.name;
    select.appendChild(opt);
  });
  select.value = currentVal;
}

function loadClientToForm() {
  const select = document.getElementById('client-select');
  const clientId = select.value;
  if (!clientId) return;

  const client = allClients.find(c => c.id === clientId);
  if (!client) return;

  document.getElementById('to-name').value = client.name || '';
  document.getElementById('to-email').value = client.email || '';
  document.getElementById('to-phone').value = client.phone || '';
  document.getElementById('to-address').value = client.address || '';
  document.getElementById('to-city').value = client.city || '';
  document.getElementById('to-state-zip').value = client.stateZip || '';
  document.getElementById('to-country').value = client.country || '';
  showToast('👤 Client loaded into invoice', 'success');
}

function useClientInInvoice(id) {
  const client = allClients.find(c => c.id === id);
  if (!client) return;

  openNewInvoice();
  document.getElementById('to-name').value = client.name || '';
  document.getElementById('to-email').value = client.email || '';
  document.getElementById('to-phone').value = client.phone || '';
  document.getElementById('to-address').value = client.address || '';
  document.getElementById('to-city').value = client.city || '';
  document.getElementById('to-state-zip').value = client.stateZip || '';
  document.getElementById('to-country').value = client.country || '';
  showToast('👤 Client loaded into new invoice', 'success');
}

// ============================================================
// SETTINGS
// ============================================================
function loadSettingsIntoForm() {
  if (!userSettings) return;
  document.getElementById('settings-company-name').value = userSettings.companyName || '';
  document.getElementById('settings-company-email').value = userSettings.companyEmail || '';
  document.getElementById('settings-company-phone').value = userSettings.companyPhone || '';
  document.getElementById('settings-company-address').value = userSettings.companyAddress || '';
  document.getElementById('settings-company-city').value = userSettings.companyCity || '';
  document.getElementById('settings-company-state-zip').value = userSettings.companyStateZip || '';
  document.getElementById('settings-company-country').value = userSettings.companyCountry || '';
  document.getElementById('settings-currency').value = userSettings.currency || 'USD';
}

function loadSettingsIntoEditor() {
  if (!userSettings) return;
  document.getElementById('from-name').value = userSettings.companyName || '';
  document.getElementById('from-email').value = userSettings.companyEmail || '';
  document.getElementById('from-phone').value = userSettings.companyPhone || '';
  document.getElementById('from-address').value = userSettings.companyAddress || '';
  document.getElementById('from-city').value = userSettings.companyCity || '';
  document.getElementById('from-state-zip').value = userSettings.companyStateZip || '';
  document.getElementById('from-country').value = userSettings.companyCountry || '';
  document.getElementById('inv-currency').value = userSettings.currency || 'USD';
}

async function saveSettings() {
  if (!currentUser) return;

  const settingsData = {
    userId: currentUser.id,
    companyName: document.getElementById('settings-company-name').value.trim(),
    companyEmail: document.getElementById('settings-company-email').value.trim(),
    companyPhone: document.getElementById('settings-company-phone').value.trim(),
    companyAddress: document.getElementById('settings-company-address').value.trim(),
    companyCity: document.getElementById('settings-company-city').value.trim(),
    companyStateZip: document.getElementById('settings-company-state-zip').value.trim(),
    companyCountry: document.getElementById('settings-company-country').value.trim(),
    currency: document.getElementById('settings-currency').value,
    updatedAt: nowTimestamp()
  };

  try {
    const db = getDB();

    if (userSettings?.id) {
      const idx = db.settings.findIndex(s => s.id === userSettings.id);
      if (idx >= 0) {
        db.settings[idx] = { ...db.settings[idx], ...settingsData };
      }
    } else {
      settingsData.id = generateId();
      settingsData.createdAt = nowTimestamp();
      db.settings.push(settingsData);
      userSettings = { id: settingsData.id, ...settingsData };
    }

    saveDB(db);
    await loadSettings();
    loadSettingsIntoEditor();
    showToast('✅ Settings saved successfully', 'success');
  } catch (error) {
    console.error('Error saving settings:', error);
    showToast('Error saving settings: ' + error.message, 'error');
  }
}

// ============================================================
// LOGO UPLOAD
// ============================================================
function handleLogoUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    showToast('Please select an image file', 'error');
    return;
  }

  if (file.size > 2 * 1024 * 1024) {
    showToast('Logo must be less than 2MB', 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    logoDataUrl = e.target.result;

    document.getElementById('from-logo').value = file.name;
    showToast('✅ Logo uploaded', 'success');
  };
  reader.readAsDataURL(file);
}

// ============================================================
// PREVIEW
// ============================================================
function previewInvoice(id) {
  const inv = allInvoices.find(i => i.id === id);
  if (!inv) return;

  const content = document.getElementById('preview-content');
  content.innerHTML = renderInvoiceHTML(inv);

  const modal = document.getElementById('preview-modal');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function closePreviewModal() {
  const modal = document.getElementById('preview-modal');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

function renderInvoiceHTML(inv) {
  const currency = inv.currency || 'USD';
  const statusColors = {
    draft: 'bg-gray-100 text-gray-600',
    sent: 'bg-blue-100 text-blue-600',
    paid: 'bg-green-100 text-green-600',
    overdue: 'bg-red-100 text-red-600',
  };
  const statusColor = statusColors[inv.status] || 'bg-gray-100 text-gray-600';

  const itemsRows = (inv.items || []).map(item => `
    <tr class="border-b border-gray-100">
      <td class="py-3 pr-4">${escapeHtml(item.description || '')}</td>
      <td class="py-3 px-4 text-center">${item.quantity || 0}</td>
      <td class="py-3 px-4 text-right">${formatCurrency(item.unitPrice || 0, currency)}</td>
      <td class="py-3 px-4 text-right">${item.taxRate || 0}%</td>
      <td class="py-3 pl-4 text-right font-medium">${formatCurrency(item.total || 0, currency)}</td>
    </tr>
  `).join('');

  return `
    <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-8 max-w-3xl mx-auto">
      <!-- Header -->
      <div class="flex items-start justify-between border-b border-gray-200 pb-6">
        <div>
          ${inv.logoDataUrl ? `<img src="${inv.logoDataUrl}" alt="Logo" class="h-14 w-auto mb-3 object-contain">` : ''}
          ${inv.fromLogo && !inv.logoDataUrl ? `<img src="${escapeAttr(inv.fromLogo)}" alt="Logo" class="h-14 w-auto mb-3 object-contain">` : ''}
          <h2 class="text-2xl font-bold text-gray-900">${escapeHtml(inv.fromName || 'Your Company')}</h2>
          ${inv.fromAddress ? `<p class="text-sm text-gray-500">${escapeHtml(inv.fromAddress)}</p>` : ''}
          ${inv.fromCity ? `<p class="text-sm text-gray-500">${escapeHtml(inv.fromCity)}${inv.fromStateZip ? ', ' + escapeHtml(inv.fromStateZip) : ''}${inv.fromCountry ? ', ' + escapeHtml(inv.fromCountry) : ''}</p>` : ''}
          ${inv.fromEmail ? `<p class="text-sm text-gray-500">${escapeHtml(inv.fromEmail)}</p>` : ''}
          ${inv.fromPhone ? `<p class="text-sm text-gray-500">${escapeHtml(inv.fromPhone)}</p>` : ''}
        </div>
        <div class="text-right">
          <h1 class="text-3xl font-bold text-indigo-600">INVOICE</h1>
          <p class="text-lg font-semibold text-gray-900 mt-2">${escapeHtml(inv.number || '')}</p>
          <div class="mt-3 space-y-1 text-sm">
            <p class="text-gray-500">Issue Date: <span class="font-medium text-gray-900">${inv.date ? formatDate(inv.date) : '—'}</span></p>
            <p class="text-gray-500">Due Date: <span class="font-medium text-gray-900">${inv.dueDate ? formatDate(inv.dueDate) : '—'}</span></p>
          </div>
          <span class="inline-block mt-3 px-3 py-1 rounded-full text-xs font-semibold ${statusColor}">${inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}</span>
        </div>
      </div>

      <!-- Bill To -->
      <div class="py-6 border-b border-gray-200">
        <p class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Bill To</p>
        <h3 class="text-lg font-bold text-gray-900">${escapeHtml(inv.toName || '')}</h3>
        ${inv.toAddress ? `<p class="text-sm text-gray-500">${escapeHtml(inv.toAddress)}</p>` : ''}
        ${inv.toCity ? `<p class="text-sm text-gray-500">${escapeHtml(inv.toCity)}${inv.toStateZip ? ', ' + escapeHtml(inv.toStateZip) : ''}${inv.toCountry ? ', ' + escapeHtml(inv.toCountry) : ''}</p>` : ''}
        ${inv.toEmail ? `<p class="text-sm text-gray-500">${escapeHtml(inv.toEmail)}</p>` : ''}
        ${inv.toPhone ? `<p class="text-sm text-gray-500">${escapeHtml(inv.toPhone)}</p>` : ''}
      </div>

      <!-- Items Table -->
      <div class="py-6">
        <table class="w-full text-sm">
          <thead>
            <tr class="bg-gray-50 text-gray-500 text-left">
              <th class="py-2.5 px-4 font-medium rounded-l-lg">Description</th>
              <th class="py-2.5 px-4 font-medium text-center">Qty</th>
              <th class="py-2.5 px-4 font-medium text-right">Unit Price</th>
              <th class="py-2.5 px-4 font-medium text-right">Tax</th>
              <th class="py-2.5 px-4 font-medium text-right rounded-r-lg">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRows || '<tr><td colspan="5" class="py-4 text-center text-gray-400">No items</td></tr>'}
          </tbody>
        </table>
      </div>

      <!-- Totals -->
      <div class="flex justify-end">
        <div class="w-72 space-y-2">
          <div class="flex justify-between text-sm">
            <span class="text-gray-500">Subtotal</span>
            <span class="font-medium text-gray-900">${formatCurrency(inv.subtotal || 0, currency)}</span>
          </div>
          ${inv.discountAmount > 0 ? `
          <div class="flex justify-between text-sm">
            <span class="text-gray-500">Discount (${inv.discountType === 'percentage' ? inv.discountValue + '%' : formatCurrency(inv.discountValue, currency)})</span>
            <span class="font-medium text-red-500">-${formatCurrency(inv.discountAmount, currency)}</span>
          </div>` : ''}
          <div class="flex justify-between text-sm">
            <span class="text-gray-500">Tax</span>
            <span class="font-medium text-gray-900">${formatCurrency(inv.taxTotal || 0, currency)}</span>
          </div>
          ${inv.shippingCost > 0 ? `
          <div class="flex justify-between text-sm">
            <span class="text-gray-500">Shipping</span>
            <span class="font-medium text-gray-900">${formatCurrency(inv.shippingCost, currency)}</span>
          </div>` : ''}
          <div class="flex justify-between border-t border-gray-200 pt-2">
            <span class="font-bold text-gray-900">Total</span>
            <span class="text-xl font-bold text-indigo-600">${formatCurrency(inv.total || 0, currency)}</span>
          </div>
        </div>
      </div>

      <!-- Notes & Terms -->
      ${inv.notes ? `
      <div class="mt-6 pt-6 border-t border-gray-200">
        <p class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Notes</p>
        <p class="text-sm text-gray-600 whitespace-pre-line">${escapeHtml(inv.notes)}</p>
      </div>` : ''}
      ${inv.terms ? `
      <div class="mt-4">
        <p class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Terms & Conditions</p>
        <p class="text-sm text-gray-600 whitespace-pre-line">${escapeHtml(inv.terms)}</p>
      </div>` : ''}
    </div>
  `;
}

// ============================================================
// PDF GENERATION
// ============================================================
function generatePDF() {
  // Get current invoice data from form
  const invoiceData = getInvoiceDataFromForm();
  if (!invoiceData) return;

  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Colors
    const primaryColor = [79, 70, 229]; // indigo-600
    const grayColor = [107, 114, 128];
    const lightGray = [243, 244, 246];
    const darkColor = [17, 24, 39];

    // Header
    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('INVOICE', 14, 16);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(invoiceData.number || '', 196, 16, { align: 'right' });

    // Company info
    doc.setTextColor(...darkColor);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(invoiceData.fromName || 'Your Company', 14, 30);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...grayColor);

    let y = 36;
    if (invoiceData.fromAddress) { doc.text(invoiceData.fromAddress, 14, y); y += 4; }
    if (invoiceData.fromCity) {
      const cityLine = [invoiceData.fromCity, invoiceData.fromStateZip, invoiceData.fromCountry].filter(Boolean).join(', ');
      doc.text(cityLine, 14, y); y += 4;
    }
    if (invoiceData.fromEmail) { doc.text(invoiceData.fromEmail, 14, y); y += 4; }
    if (invoiceData.fromPhone) { doc.text(invoiceData.fromPhone, 14, y); y += 4; }

    // Invoice meta (right side)
    let metaY = 30;
    doc.setFontSize(9);
    doc.setTextColor(...grayColor);
    doc.setFont('helvetica', 'normal');

    doc.text('Issue Date:', 140, metaY);
    doc.setTextColor(...darkColor);
    doc.setFont('helvetica', 'bold');
    doc.text(invoiceData.date ? formatDate(invoiceData.date) : '—', 196, metaY, { align: 'right' });
    metaY += 5;

    doc.setTextColor(...grayColor);
    doc.setFont('helvetica', 'normal');
    doc.text('Due Date:', 140, metaY);
    doc.setTextColor(...darkColor);
    doc.setFont('helvetica', 'bold');
    doc.text(invoiceData.dueDate ? formatDate(invoiceData.dueDate) : '—', 196, metaY, { align: 'right' });
    metaY += 5;

    doc.setTextColor(...grayColor);
    doc.setFont('helvetica', 'normal');
    doc.text('Status:', 140, metaY);
    doc.setTextColor(...primaryColor);
    doc.setFont('helvetica', 'bold');
    doc.text((invoiceData.status || 'draft').charAt(0).toUpperCase() + (invoiceData.status || 'draft').slice(1), 196, metaY, { align: 'right' });

    // Bill To section
    let billY = Math.max(y + 10, metaY + 10);
    doc.setFillColor(...lightGray);
    doc.roundedRect(14, billY - 5, 182, 28, 2, 2, 'F');
    doc.setTextColor(...grayColor);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('BILL TO', 18, billY);

    doc.setTextColor(...darkColor);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(invoiceData.toName || '', 18, billY + 7);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...grayColor);
    let by = billY + 12;
    if (invoiceData.toAddress) { doc.text(invoiceData.toAddress, 18, by); by += 4; }
    if (invoiceData.toCity) {
      const cityLine = [invoiceData.toCity, invoiceData.toStateZip, invoiceData.toCountry].filter(Boolean).join(', ');
      doc.text(cityLine, 18, by); by += 4;
    }
    if (invoiceData.toEmail) { doc.text(invoiceData.toEmail, 18, by); by += 4; }
    if (invoiceData.toPhone) { doc.text(invoiceData.toPhone, 18, by); by += 4; }

    // Items table
    const startY = Math.max(by + 10, billY + 38);
    const items = invoiceData.items || [];
    const tableRows = items.map(item => [
      item.description || '',
      String(item.quantity || 0),
      formatCurrency(item.unitPrice || 0, invoiceData.currency),
      (item.taxRate || 0) + '%',
      formatCurrency(item.total || 0, invoiceData.currency)
    ]);

    doc.autoTable({
      startY: startY,
      head: [['Description', 'Qty', 'Unit Price', 'Tax', 'Amount']],
      body: tableRows,
      theme: 'striped',
      headStyles: {
        fillColor: primaryColor,
        fontSize: 9,
        fontStyle: 'bold',
        halign: 'left',
        cellPadding: 3,
      },
      styles: {
        fontSize: 9,
        cellPadding: 3,
        textColor: darkColor,
      },
      columnStyles: {
        0: { cellWidth: 80 },
        1: { cellWidth: 20, halign: 'center' },
        2: { cellWidth: 30, halign: 'right' },
        3: { cellWidth: 20, halign: 'right' },
        4: { cellWidth: 32, halign: 'right' },
      },
      margin: { left: 14, right: 14 },
    });

    // Totals
    let totalY = doc.lastAutoTable.finalY + 10;
    const rightX = 196;

    doc.setFontSize(9);
    doc.setTextColor(...grayColor);
    doc.setFont('helvetica', 'normal');
    doc.text('Subtotal:', 150, totalY);
    doc.setTextColor(...darkColor);
    doc.setFont('helvetica', 'bold');
    doc.text(formatCurrency(invoiceData.subtotal || 0, invoiceData.currency), rightX, totalY, { align: 'right' });
    totalY += 6;

    if (invoiceData.discountAmount > 0) {
      doc.setTextColor(...grayColor);
      doc.setFont('helvetica', 'normal');
      doc.text('Discount:', 150, totalY);
      doc.setTextColor(220, 38, 38);
      doc.setFont('helvetica', 'bold');
      doc.text('-' + formatCurrency(invoiceData.discountAmount, invoiceData.currency), rightX, totalY, { align: 'right' });
      totalY += 6;
    }

    doc.setTextColor(...grayColor);
    doc.setFont('helvetica', 'normal');
    doc.text('Tax:', 150, totalY);
    doc.setTextColor(...darkColor);
    doc.setFont('helvetica', 'bold');
    doc.text(formatCurrency(invoiceData.taxTotal || 0, invoiceData.currency), rightX, totalY, { align: 'right' });
    totalY += 6;

    if (invoiceData.shippingCost > 0) {
      doc.setTextColor(...grayColor);
      doc.setFont('helvetica', 'normal');
      doc.text('Shipping:', 150, totalY);
      doc.setTextColor(...darkColor);
      doc.setFont('helvetica', 'bold');
      doc.text(formatCurrency(invoiceData.shippingCost, invoiceData.currency), rightX, totalY, { align: 'right' });
      totalY += 6;
    }

    // Total box
    doc.setFillColor(...primaryColor);
    doc.roundedRect(130, totalY - 2, 66, 10, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Total:', 136, totalY + 5);
    doc.text(formatCurrency(invoiceData.total || 0, invoiceData.currency), 196, totalY + 5, { align: 'right' });

    // Notes and Terms
    let notesY = totalY + 15;
    if (invoiceData.notes) {
      doc.setTextColor(...grayColor);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text('NOTES', 14, notesY);
      notesY += 5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...darkColor);
      const notesLines = doc.splitTextToSize(invoiceData.notes, 182);
      doc.text(notesLines, 14, notesY);
      notesY += notesLines.length * 4 + 5;
    }

    if (invoiceData.terms) {
      doc.setTextColor(...grayColor);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text('TERMS & CONDITIONS', 14, notesY);
      notesY += 5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...darkColor);
      const termsLines = doc.splitTextToSize(invoiceData.terms, 182);
      doc.text(termsLines, 14, notesY);
    }

    // Footer
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFontSize(8);
    doc.setTextColor(...grayColor);
    doc.setFont('helvetica', 'normal');
    doc.text('Generated with InvoiceGen', 105, pageHeight - 8, { align: 'center' });

    // Save PDF
    const fileName = `${invoiceData.number || 'invoice'}.pdf`;
    doc.save(fileName);
    showToast('📄 PDF generated successfully', 'success');
  } catch (error) {
    console.error('Error generating PDF:', error);
    showToast('Error generating PDF: ' + error.message, 'error');
  }
}

function getInvoiceDataFromForm() {
  const toName = document.getElementById('to-name').value.trim();
  if (!toName) {
    showToast('Please enter a client name', 'error');
    return null;
  }

  const items = getItems();
  if (!items.length) {
    showToast('Please add at least one item', 'error');
    return null;
  }

  const subtotal = items.reduce((sum, i) => sum + i.amount, 0);
  const taxTotal = items.reduce((sum, i) => sum + i.taxAmount, 0);
  const discountType = document.getElementById('discount-type').value;
  const discountValue = parseFloat(document.getElementById('discount-value').value) || 0;
  let discountAmount = 0;
  if (discountType === 'percentage') {
    discountAmount = (subtotal * discountValue) / 100;
  } else {
    discountAmount = Math.min(discountValue, subtotal);
  }
  const shipping = parseFloat(document.getElementById('shipping-cost').value) || 0;
  const total = Math.max(0, subtotal - discountAmount + taxTotal + shipping);

  return {
    number: document.getElementById('inv-number').value.trim(),
    date: document.getElementById('inv-date').value,
    dueDate: document.getElementById('inv-due-date').value,
    status: document.getElementById('inv-status').value,
    fromName: document.getElementById('from-name').value.trim(),
    fromEmail: document.getElementById('from-email').value.trim(),
    fromPhone: document.getElementById('from-phone').value.trim(),
    fromAddress: document.getElementById('from-address').value.trim(),
    fromCity: document.getElementById('from-city').value.trim(),
    fromStateZip: document.getElementById('from-state-zip').value.trim(),
    fromCountry: document.getElementById('from-country').value.trim(),
    fromLogo: document.getElementById('from-logo').value.trim(),
    logoDataUrl: logoDataUrl,
    toName: toName,
    toEmail: document.getElementById('to-email').value.trim(),
    toPhone: document.getElementById('to-phone').value.trim(),
    toAddress: document.getElementById('to-address').value.trim(),
    toCity: document.getElementById('to-city').value.trim(),
    toStateZip: document.getElementById('to-state-zip').value.trim(),
    toCountry: document.getElementById('to-country').value.trim(),
    items: items,
    subtotal: subtotal,
    taxTotal: taxTotal,
    discountType: discountType,
    discountValue: discountValue,
    discountAmount: discountAmount,
    shippingCost: shipping,
    total: total,
    currency: document.getElementById('inv-currency').value,
    notes: document.getElementById('inv-notes').value.trim(),
    terms: document.getElementById('inv-terms').value.trim(),
  };
}

// ============================================================
// SEND EMAIL (Opens Email App)
// ============================================================
async function sendInvoiceEmail() {
  const invoiceData = getInvoiceDataFromForm();
  if (!invoiceData) return;

  if (!invoiceData.toEmail) {
    showToast('Please enter a client email address', 'error');
    return;
  }

  // Generate PDF blob first
  let pdfBlob = null;
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    // Reuse PDF generation logic
    buildPDF(doc, invoiceData);
    pdfBlob = doc.output('blob');
  } catch (error) {
    console.error('Error generating PDF for email:', error);
    showToast('Error generating PDF: ' + error.message, 'error');
    return;
  }

  const subject = `Invoice ${invoiceData.number} from ${invoiceData.fromName || 'Your Company'}`;
  const body = `Dear ${invoiceData.toName},\n\nPlease find attached invoice ${invoiceData.number} for ${formatCurrency(invoiceData.total, invoiceData.currency)}.\n\nThank you for your business!\n\n${invoiceData.fromName || 'Your Company'}`;

  // Try Web Share API first (opens email app with PDF attached)
  if (navigator.share && navigator.canShare) {
    try {
      const file = new File([pdfBlob], `${invoiceData.number || 'invoice'}.pdf`, { type: 'application/pdf' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: subject,
          text: body
        });
        showToast('✉️ Email app opened with invoice attached', 'success');

        // Update status to sent
        document.getElementById('inv-status').value = 'sent';
        await saveInvoice('sent');
        return;
      }
    } catch (error) {
      // User cancelled or share failed - fall through to mailto
      console.log('Web Share failed, falling back to mailto:', error);
    }
  }

  // Fallback: open email client with mailto link
  const mailtoUrl = `mailto:${encodeURIComponent(invoiceData.toEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.location.href = mailtoUrl;

  // Also trigger PDF download so user can attach it manually
  const downloadLink = document.createElement('a');
  downloadLink.href = URL.createObjectURL(pdfBlob);
  downloadLink.download = `${invoiceData.number || 'invoice'}.pdf`;
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);
  URL.revokeObjectURL(downloadLink.href);

  showToast('✉️ Email app opened - please attach the downloaded PDF and send', 'success');

  // Update status to sent
  document.getElementById('inv-status').value = 'sent';
  await saveInvoice('sent');
}

function buildPDF(doc, invoiceData) {
  // Colors
  const primaryColor = [79, 70, 229];
  const grayColor = [107, 114, 128];
  const lightGray = [243, 244, 246];
  const darkColor = [17, 24, 39];

  // Header
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, 210, 40, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('INVOICE', 14, 16);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(invoiceData.number || '', 196, 16, { align: 'right' });

  // Company info
  doc.setTextColor(...darkColor);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(invoiceData.fromName || 'Your Company', 14, 30);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...grayColor);

  let y = 36;
  if (invoiceData.fromAddress) { doc.text(invoiceData.fromAddress, 14, y); y += 4; }
  if (invoiceData.fromCity) {
    const cityLine = [invoiceData.fromCity, invoiceData.fromStateZip, invoiceData.fromCountry].filter(Boolean).join(', ');
    doc.text(cityLine, 14, y); y += 4;
  }
  if (invoiceData.fromEmail) { doc.text(invoiceData.fromEmail, 14, y); y += 4; }
  if (invoiceData.fromPhone) { doc.text(invoiceData.fromPhone, 14, y); y += 4; }

  // Invoice meta (right side)
  let metaY = 30;
  doc.setFontSize(9);
  doc.setTextColor(...grayColor);
  doc.setFont('helvetica', 'normal');

  doc.text('Issue Date:', 140, metaY);
  doc.setTextColor(...darkColor);
  doc.setFont('helvetica', 'bold');
  doc.text(invoiceData.date ? formatDate(invoiceData.date) : '—', 196, metaY, { align: 'right' });
  metaY += 5;

  doc.setTextColor(...grayColor);
  doc.setFont('helvetica', 'normal');
  doc.text('Due Date:', 140, metaY);
  doc.setTextColor(...darkColor);
  doc.setFont('helvetica', 'bold');
  doc.text(invoiceData.dueDate ? formatDate(invoiceData.dueDate) : '—', 196, metaY, { align: 'right' });
  metaY += 5;

  doc.setTextColor(...grayColor);
  doc.setFont('helvetica', 'normal');
  doc.text('Status:', 140, metaY);
  doc.setTextColor(...primaryColor);
  doc.setFont('helvetica', 'bold');
  doc.text((invoiceData.status || 'draft').charAt(0).toUpperCase() + (invoiceData.status || 'draft').slice(1), 196, metaY, { align: 'right' });

  // Bill To section
  let billY = Math.max(y + 10, metaY + 10);
  doc.setFillColor(...lightGray);
  doc.roundedRect(14, billY - 5, 182, 28, 2, 2, 'F');
  doc.setTextColor(...grayColor);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('BILL TO', 18, billY);

  doc.setTextColor(...darkColor);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(invoiceData.toName || '', 18, billY + 7);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...grayColor);
  let by = billY + 12;
  if (invoiceData.toAddress) { doc.text(invoiceData.toAddress, 18, by); by += 4; }
  if (invoiceData.toCity) {
    const cityLine = [invoiceData.toCity, invoiceData.toStateZip, invoiceData.toCountry].filter(Boolean).join(', ');
    doc.text(cityLine, 18, by); by += 4;
  }
  if (invoiceData.toEmail) { doc.text(invoiceData.toEmail, 18, by); by += 4; }
  if (invoiceData.toPhone) { doc.text(invoiceData.toPhone, 18, by); by += 4; }

  // Items table
  const startY = Math.max(by + 10, billY + 38);
  const items = invoiceData.items || [];
  const tableRows = items.map(item => [
    item.description || '',
    String(item.quantity || 0),
    formatCurrency(item.unitPrice || 0, invoiceData.currency),
    (item.taxRate || 0) + '%',
    formatCurrency(item.total || 0, invoiceData.currency)
  ]);

  doc.autoTable({
    startY: startY,
    head: [['Description', 'Qty', 'Unit Price', 'Tax', 'Amount']],
    body: tableRows,
    theme: 'striped',
    headStyles: {
      fillColor: primaryColor,
      fontSize: 9,
      fontStyle: 'bold',
      halign: 'left',
      cellPadding: 3,
    },
    styles: {
      fontSize: 9,
      cellPadding: 3,
      textColor: darkColor,
    },
    columnStyles: {
      0: { cellWidth: 80 },
      1: { cellWidth: 20, halign: 'center' },
      2: { cellWidth: 30, halign: 'right' },
      3: { cellWidth: 20, halign: 'right' },
      4: { cellWidth: 32, halign: 'right' },
    },
    margin: { left: 14, right: 14 },
  });

  // Totals
  let totalY = doc.lastAutoTable.finalY + 10;
  const rightX = 196;

  doc.setFontSize(9);
  doc.setTextColor(...grayColor);
  doc.setFont('helvetica', 'normal');
  doc.text('Subtotal:', 150, totalY);
  doc.setTextColor(...darkColor);
  doc.setFont('helvetica', 'bold');
  doc.text(formatCurrency(invoiceData.subtotal || 0, invoiceData.currency), rightX, totalY, { align: 'right' });
  totalY += 6;

  if (invoiceData.discountAmount > 0) {
    doc.setTextColor(...grayColor);
    doc.setFont('helvetica', 'normal');
    doc.text('Discount:', 150, totalY);
    doc.setTextColor(220, 38, 38);
    doc.setFont('helvetica', 'bold');
    doc.text('-' + formatCurrency(invoiceData.discountAmount, invoiceData.currency), rightX, totalY, { align: 'right' });
    totalY += 6;
  }

  doc.setTextColor(...grayColor);
  doc.setFont('helvetica', 'normal');
  doc.text('Tax:', 150, totalY);
  doc.setTextColor(...darkColor);
  doc.setFont('helvetica', 'bold');
  doc.text(formatCurrency(invoiceData.taxTotal || 0, invoiceData.currency), rightX, totalY, { align: 'right' });
  totalY += 6;

  if (invoiceData.shippingCost > 0) {
    doc.setTextColor(...grayColor);
    doc.setFont('helvetica', 'normal');
    doc.text('Shipping:', 150, totalY);
    doc.setTextColor(...darkColor);
    doc.setFont('helvetica', 'bold');
    doc.text(formatCurrency(invoiceData.shippingCost, invoiceData.currency), rightX, totalY, { align: 'right' });
    totalY += 6;
  }

  // Total box
  doc.setFillColor(...primaryColor);
  doc.roundedRect(130, totalY - 2, 66, 10, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Total:', 136, totalY + 5);
  doc.text(formatCurrency(invoiceData.total || 0, invoiceData.currency), 196, totalY + 5, { align: 'right' });

  // Notes and Terms
  let notesY = totalY + 15;
  if (invoiceData.notes) {
    doc.setTextColor(...grayColor);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('NOTES', 14, notesY);
    notesY += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...darkColor);
    const notesLines = doc.splitTextToSize(invoiceData.notes, 182);
    doc.text(notesLines, 14, notesY);
    notesY += notesLines.length * 4 + 5;
  }

  if (invoiceData.terms) {
    doc.setTextColor(...grayColor);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('TERMS & CONDITIONS', 14, notesY);
    notesY += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...darkColor);
    const termsLines = doc.splitTextToSize(invoiceData.terms, 182);
    doc.text(termsLines, 14, notesY);
  }

  // Footer
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFontSize(8);
  doc.setTextColor(...grayColor);
  doc.setFont('helvetica', 'normal');
  doc.text('Generated with InvoiceGen', 105, pageHeight - 8, { align: 'center' });
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      const base64 = dataUrl.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// ============================================================
// CONFIRM MODAL
// ============================================================
function showConfirmModal(title, message, callback) {
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-message').textContent = message;
  confirmCallback = callback;
  const modal = document.getElementById('confirm-modal');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function closeConfirmModal() {
  const modal = document.getElementById('confirm-modal');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
  confirmCallback = null;
}

// ============================================================
// UI HELPERS
// ============================================================
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const colors = {
    success: 'bg-green-50 border-green-200 text-green-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
  };
  const icons = {
    success: '✅',
    error: '❌',
    info: 'ℹ️',
  };
  const toast = document.createElement('div');
  toast.className = `flex items-start gap-3 p-4 rounded-xl border shadow-lg ${colors[type] || colors.info} animate-slide-in`;
  toast.innerHTML = `
    <span class="text-lg">${icons[type] || icons.info}</span>
    <p class="text-sm font-medium flex-1">${message}</p>
    <button onclick="this.parentElement.remove()" class="text-gray-400 hover:text-gray-600 ml-2">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
    </button>
  `;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function formatCurrency(amount, currency = 'USD') {
  const symbols = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    NGN: '₦',
    CAD: 'C$',
    AUD: 'A$',
  };
  const symbol = symbols[currency] || '$';
  return `${symbol}${Number(amount || 0).toFixed(2)}`;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr + 'T00:00:00');
  if (isNaN(date)) return dateStr;

  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatDateInput(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

function escapeAttr(str) {
  if (!str) return '';
  return String(str).replace(/"/g, '"').replace(/'/g, '&#39;').replace(/</g, '<').replace(/>/g, '>');
}

function bindUIEvents() {
  // Close modals when clicking outside
  document.querySelectorAll('.fixed.inset-0').forEach(overlay => {
    // Handled by onclick attributes
  });
}

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  // Bind auth forms
  document.getElementById('login-form-element').addEventListener('submit', handleLogin);
  document.getElementById('signup-form-element').addEventListener('submit', handleSignup);
  document.getElementById('logout-btn').addEventListener('click', handleLogout);

  // Bind UI events
  bindUIEvents();

  // Add initial item row
  addItemRow();
  addItemRow();

  // Set default dates
  const today = new Date();
  document.getElementById('inv-date').value = formatDateInput(today);
  const dueDate = new Date(today);
  dueDate.setDate(dueDate.getDate() + 30);
  document.getElementById('inv-due-date').value = formatDateInput(dueDate);

  // Generate default invoice number
  document.getElementById('inv-number').value = generateInvoiceNumber();

  // Load saved clients into select
  loadClientSelect();

  // Load settings into editor
  loadSettingsIntoEditor();

  // Load settings into settings view
  loadSettingsIntoForm();

  // Bind item table events
  bindItemEvents();

  // Bind search and filter
  document.getElementById('invoice-search').addEventListener('input', renderInvoicesTable);
  document.getElementById('invoice-status-filter').addEventListener('change', renderInvoicesTable);

  // Bind logo upload
  document.getElementById('from-logo-upload').addEventListener('change', handleLogoUpload);

  // Bind client form
  document.getElementById('client-form').addEventListener('submit', handleClientFormSubmit);

  // Bind discount/shipping recalc
  document.getElementById('discount-type').addEventListener('change', calculateTotals);
  document.getElementById('discount-value').addEventListener('input', calculateTotals);
  document.getElementById('shipping-cost').addEventListener('input', calculateTotals);
  document.getElementById('inv-currency').addEventListener('change', calculateTotals);

  // Bind sidebar mobile
  document.getElementById('menu-btn').addEventListener('click', toggleSidebar);
  document.getElementById('sidebar-overlay').addEventListener('click', toggleSidebar);

  // Bind new invoice buttons
  document.getElementById('new-invoice-top-btn').addEventListener('click', openNewInvoice);

  // Bind nav buttons
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => showView(btn.dataset.view));
  });

  // Bind confirm modal action
  document.getElementById('confirm-action-btn').addEventListener('click', () => {
    if (confirmCallback) confirmCallback();
    closeConfirmModal();
  });

  // Bind Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closePreviewModal();
      closeClientModal();
      closeConfirmModal();
    }
  });

  // Initialize Firebase Auth
  initFirebase();
});