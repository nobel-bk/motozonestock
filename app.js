/**
 * Moto Zone Workshop - Spare Parts & Stock Management System
 * Firebase Firestore + Firebase Auth powered
 */

(function () {
  'use strict';

  // =====================================================
  // FIREBASE CONFIGURATION
  // =====================================================
  const firebaseConfig = {
    apiKey: "AIzaSyAwNoEgIknQTX6EQ4WYN66ls5YGp7Ii0yg",
    authDomain: "moto-zone-stock.firebaseapp.com",
    projectId: "moto-zone-stock",
    storageBucket: "moto-zone-stock.firebasestorage.app",
    messagingSenderId: "843038006376",
    appId: "1:843038006376:web:fdcc2d6e6d42d572872fdd"
  };

  firebase.initializeApp(firebaseConfig);
  const auth = firebase.auth();
  const db = firebase.firestore();

  // =====================================================
  // APP STATE
  // =====================================================
  const STATE = {
    parts: [],
    transactions: [],
    currentUser: null,
    search: '',
    filterStore: 'ALL',
    filterType: 'ALL',
    filterStatus: 'ALL',
    currentPage: 1,
    pageSize: 25,
    activeSection: 'dashboard',
    reportMode: 'daily',
    previewImportData: [],
    theme: localStorage.getItem('MOTO_THEME') || 'dark',
    isSeeded: false,
    unsubscribeParts: null
  };

  let chartTopPartsInstance = null;
  let chartTypeInstance = null;

  // =====================================================
  // AUTH GUARD — Check Login
  // =====================================================
  auth.onAuthStateChanged(user => {
    const overlay = document.getElementById('authLoadingOverlay');
    const appWrapper = document.getElementById('appWrapper');

    if (user) {
      STATE.currentUser = user;
      overlay.style.display = 'none';
      appWrapper.style.display = 'flex';

      // Show user email
      const emailEl = document.getElementById('userEmailDisplay');
      if (emailEl) emailEl.textContent = user.email;

      initApp();
    } else {
      // Not logged in → redirect to login
      window.location.href = 'login.html';
    }
  });

  // =====================================================
  // APP INITIALIZATION
  // =====================================================
  function initApp() {
    initTheme();
    setupEventListeners();
    initClock();
    initReportDates();
    loadPartsFromFirestore();
  }

  // =====================================================
  // FIREBASE FIRESTORE — REAL-TIME LISTENER
  // =====================================================
  function loadPartsFromFirestore() {
    showToast('Firebase থেকে স্টক ডাটা লোড হচ্ছে...', 'info');

    // Real-time listener on 'parts' collection
    STATE.unsubscribeParts = db.collection('parts')
      .orderBy('sl', 'asc')
      .onSnapshot(
        snapshot => {
          if (snapshot.empty) {
            // First time — seed the database with initialData.js
            seedDatabaseFromInitialData();
            return;
          }

          STATE.parts = [];
          snapshot.forEach(doc => {
            STATE.parts.push({ docId: doc.id, ...doc.data() });
          });

          populateFilters();
          renderAll();
          showToast(`${STATE.parts.length}টি পার্টস Firebase থেকে লোড হয়েছে ✅`, 'success');
        },
        error => {
          console.error('Firestore error:', error);
          showToast('ডাটা লোড করতে সমস্যা হয়েছে! ইন্টারনেট কানেকশন চেক করুন।', 'error');
        }
      );

    // Load transactions separately (no real-time needed)
    loadTransactions();
  }

  async function loadTransactions() {
    try {
      const snap = await db.collection('transactions').orderBy('createdAt', 'desc').limit(500).get();
      STATE.transactions = snap.docs.map(d => ({ docId: d.id, ...d.data() }));
    } catch (e) {
      STATE.transactions = [];
    }
  }

  // Seed Firestore with initialData.js (first time only)
  async function seedDatabaseFromInitialData() {
    const initialData = window.INITIAL_PARTS_DATA;
    if (!initialData || initialData.length === 0) return;

    showToast('প্রথমবার চালু হচ্ছে — ডাটাবেজ প্রস্তুত করা হচ্ছে...', 'info');

    // Batch write (Firestore allows max 500 per batch)
    const batchSize = 400;
    for (let i = 0; i < initialData.length; i += batchSize) {
      const batch = db.batch();
      const chunk = initialData.slice(i, i + batchSize);

      chunk.forEach(item => {
        const docRef = db.collection('parts').doc();
        batch.set(docRef, {
          sl: item.sl || i,
          store: item.store || 'Moto Zone Workshop',
          partNo: item.partNo || '',
          rcvDate: item.rcvDate || '',
          invoiceNo: item.invoiceNo || '',
          lcNo: item.lcNo || '',
          description: item.description || '',
          type: item.type || 'H',
          qty: item.qty || 0,
          unitPrice: item.unitPrice || 0,
          totalPrice: (item.qty || 0) * (item.unitPrice || 0),
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      });

      await batch.commit();
    }

    showToast(`${initialData.length}টি পার্টস সফলভাবে Firebase-এ সেভ হয়েছে! ✅`, 'success');
  }

  // =====================================================
  // CRUD: ADD / UPDATE / DELETE PART in Firestore
  // =====================================================
  async function savePartToFirestore(partData, docId = null) {
    try {
      if (docId) {
        // Update existing
        await db.collection('parts').doc(docId).update({
          ...partData,
          totalPrice: (partData.qty || 0) * (partData.unitPrice || 0),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        showToast('পার্টস Firebase-এ আপডেট হয়েছে! ✅', 'success');
      } else {
        // Add new
        await db.collection('parts').add({
          ...partData,
          sl: Date.now(),
          totalPrice: (partData.qty || 0) * (partData.unitPrice || 0),
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        showToast('নতুন পার্টস Firebase-এ যোগ হয়েছে! ✅', 'success');
      }
    } catch (err) {
      console.error('Save error:', err);
      showToast('সেভ করতে সমস্যা হয়েছে! ইন্টারনেট চেক করুন।', 'error');
    }
  }

  async function deletePartFromFirestore(docId) {
    try {
      await db.collection('parts').doc(docId).delete();
      showToast('পার্টস সফলভাবে মুছে ফেলা হয়েছে!', 'info');
    } catch (err) {
      showToast('ডিলিট করতে সমস্যা হয়েছে!', 'error');
    }
  }

  async function updatePartQtyInFirestore(docId, newQty, unitPrice) {
    try {
      await db.collection('parts').doc(docId).update({
        qty: newQty,
        totalPrice: newQty * unitPrice,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    } catch (err) {
      console.error('Update qty error:', err);
      showToast('স্টক আপডেটে সমস্যা হয়েছে!', 'error');
    }
  }

  async function saveTransaction(txData) {
    try {
      await db.collection('transactions').add({
        ...txData,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    } catch (e) {
      console.error('Transaction save error:', e);
    }
  }

  // =====================================================
  // THEME
  // =====================================================
  function initTheme() {
    if (STATE.theme === 'light') {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
      updateThemeBtnText('Light Mode', 'fa-sun');
    } else {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
      updateThemeBtnText('Dark Mode', 'fa-moon');
    }
  }

  function toggleTheme() {
    STATE.theme = STATE.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('MOTO_THEME', STATE.theme);
    initTheme();
    renderCharts();
  }

  function updateThemeBtnText(text, icon) {
    const btn = document.getElementById('themeToggleBtn');
    if (btn) btn.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${text}</span>`;
  }

  // =====================================================
  // CLOCK
  // =====================================================
  function initClock() {
    const el = document.getElementById('clockTime');
    function tick() {
      if (el) el.textContent = new Date().toLocaleTimeString('bn-BD', { hour12: true });
    }
    tick();
    setInterval(tick, 1000);
  }

  // =====================================================
  // EVENT LISTENERS
  // =====================================================
  function setupEventListeners() {
    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', e => {
        e.preventDefault();
        navigateTo(item.getAttribute('data-target'));
      });
    });

    document.getElementById('sidebarToggle')?.addEventListener('click', () => {
      document.getElementById('sidebar')?.classList.toggle('active');
    });

    document.getElementById('themeToggleBtn')?.addEventListener('click', toggleTheme);

    // Quick Actions
    document.getElementById('btnQuickReceive')?.addEventListener('click', () => openStockTxModal('RECEIVE'));
    document.getElementById('btnQuickIssue')?.addEventListener('click', () => openStockTxModal('ISSUE'));
    document.getElementById('btnAddNewPart')?.addEventListener('click', () => openPartFormModal());
    document.getElementById('btnSeeAllLowStock')?.addEventListener('click', () => navigateTo('inventory', { status: 'LOW_STOCK' }));
    document.getElementById('btnExportBackup')?.addEventListener('click', exportBackupJson);

    // Logout
    document.getElementById('btnLogout')?.addEventListener('click', async () => {
      if (confirm('লগআউট করতে চান?')) {
        if (STATE.unsubscribeParts) STATE.unsubscribeParts();
        await auth.signOut();
        window.location.href = 'login.html';
      }
    });

    // Search & Filters
    const searchInput = document.getElementById('searchInput');
    const clearBtn = document.getElementById('clearSearchBtn');
    searchInput?.addEventListener('input', e => {
      STATE.search = e.target.value;
      STATE.currentPage = 1;
      if (clearBtn) clearBtn.style.display = STATE.search ? 'block' : 'none';
      renderInventoryTable();
    });
    clearBtn?.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      STATE.search = '';
      STATE.currentPage = 1;
      if (clearBtn) clearBtn.style.display = 'none';
      renderInventoryTable();
    });

    document.getElementById('filterStore')?.addEventListener('change', e => { STATE.filterStore = e.target.value; STATE.currentPage = 1; renderInventoryTable(); });
    document.getElementById('filterType')?.addEventListener('change', e => { STATE.filterType = e.target.value; STATE.currentPage = 1; renderInventoryTable(); });
    document.getElementById('filterStatus')?.addEventListener('change', e => { STATE.filterStatus = e.target.value; STATE.currentPage = 1; renderInventoryTable(); });
    document.getElementById('btnExportFilteredExcel')?.addEventListener('click', exportFilteredToExcel);

    // Report controls
    document.getElementById('btnModeDaily')?.addEventListener('click', () => setReportMode('daily'));
    document.getElementById('btnModeMonthly')?.addEventListener('click', () => setReportMode('monthly'));
    document.getElementById('btnGenerateReport')?.addEventListener('click', generateOwnerReport);
    document.getElementById('btnPrintReport')?.addEventListener('click', () => window.print());

    // Excel import
    setupExcelImportListeners();

    // Modal close buttons
    document.querySelectorAll('[data-close]').forEach(btn => {
      btn.addEventListener('click', () => closeModal(btn.getAttribute('data-close')));
    });

    // Forms
    document.getElementById('formPart')?.addEventListener('submit', handlePartFormSubmit);
    document.getElementById('formTx')?.addEventListener('submit', handleTxFormSubmit);
  }

  // =====================================================
  // NAVIGATION
  // =====================================================
  function navigateTo(target, options = {}) {
    STATE.activeSection = target;
    document.querySelectorAll('.nav-item').forEach(i => i.classList.toggle('active', i.getAttribute('data-target') === target));
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    document.getElementById(`section-${target}`)?.classList.add('active');

    const titles = {
      dashboard: 'স্টক ওভারভিউ ড্যাশবোর্ড',
      inventory: 'পার্টস ইনভেন্টরি ও স্টক ম্যানেজমেন্ট',
      reports: 'মালিকের জন্য দৈনিক ও মাসিক রিপোর্ট',
      import: 'Excel ফাইল ডাটা ইম্পোর্ট'
    };
    document.getElementById('pageTitle').textContent = titles[target] || 'ড্যাশবোর্ড';

    if (options.status) {
      STATE.filterStatus = options.status;
      const sel = document.getElementById('filterStatus');
      if (sel) sel.value = options.status;
    }

    renderAll();
  }

  // =====================================================
  // POPULATE FILTERS & REPORT DATES
  // =====================================================
  function populateFilters() {
    const storeEl = document.getElementById('filterStore');
    const typeEl = document.getElementById('filterType');
    if (storeEl) {
      const stores = [...new Set(STATE.parts.map(p => p.store).filter(Boolean))];
      storeEl.innerHTML = '<option value="ALL">সকল স্টোর</option>' + stores.map(s => `<option value="${esc(s)}">${esc(s)}</option>`).join('');
    }
    if (typeEl) {
      const types = [...new Set(STATE.parts.map(p => p.type).filter(Boolean))];
      typeEl.innerHTML = '<option value="ALL">সকল টাইপ</option>' + types.map(t => `<option value="${esc(t)}">${esc(t)}</option>`).join('');
    }
    const badge = document.getElementById('navTotalBadge');
    if (badge) badge.textContent = STATE.parts.length;
  }

  function initReportDates() {
    const today = new Date().toISOString().split('T')[0];
    const daily = document.getElementById('reportDailyDate');
    if (daily) daily.value = today;

    const monthSel = document.getElementById('reportMonth');
    const yearSel = document.getElementById('reportYear');
    if (monthSel) {
      const months = ['জানুয়ারি','ফেব্রুয়ারি','মার্চ','এপ্রিল','মে','জুন','জুলাই','আগস্ট','সেপ্টেম্বর','অক্টোবর','নভেম্বর','ডিসেম্বর'];
      monthSel.innerHTML = months.map((m, i) => `<option value="${i+1}" ${i === new Date().getMonth() ? 'selected' : ''}>${m}</option>`).join('');
    }
    if (yearSel) {
      const y = new Date().getFullYear();
      yearSel.innerHTML = `<option value="${y}">${y}</option><option value="${y-1}">${y-1}</option>`;
    }
  }

  // =====================================================
  // RENDER ALL
  // =====================================================
  function renderAll() {
    if (STATE.activeSection === 'dashboard') renderDashboard();
    else if (STATE.activeSection === 'inventory') renderInventoryTable();
    else if (STATE.activeSection === 'reports') generateOwnerReport();
  }

  // =====================================================
  // DASHBOARD
  // =====================================================
  function renderDashboard() {
    let totalVal = 0, totalQty = 0, lowStockCount = 0;
    STATE.parts.forEach(p => {
      totalVal += (p.qty * p.unitPrice);
      totalQty += p.qty;
      if (p.qty <= 2) lowStockCount++;
    });

    document.getElementById('kpiTotalValue').textContent = fmt(totalVal);
    document.getElementById('kpiTotalQty').textContent = `${totalQty.toLocaleString()} পিস`;
    document.getElementById('kpiUniqueParts').textContent = `${STATE.parts.length}টি ইউনিক পার্টস`;
    document.getElementById('kpiLowStockCount').textContent = `${lowStockCount}টি পার্টস`;

    if (STATE.parts.length > 0) {
      document.getElementById('kpiRecentReceive').textContent = `${STATE.parts[0].qty} পিস`;
      document.getElementById('kpiRecentDate').textContent = STATE.parts[0].rcvDate || '';
    }

    renderLowStockTable();
    renderCharts();
  }

  function renderLowStockTable() {
    const tbody = document.getElementById('lowStockTableBody');
    if (!tbody) return;
    const items = STATE.parts.filter(p => p.qty <= 2).slice(0, 5);

    if (!items.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center p-4 text-emerald"><i class="fa-solid fa-circle-check"></i> সকল পার্টস পর্যাপ্ত পরিমাণে আছে!</td></tr>`;
      return;
    }

    tbody.innerHTML = items.map(p => `
      <tr>
        <td><strong>${esc(p.partNo)}</strong></td>
        <td>${esc(p.description)}</td>
        <td>${esc(p.store)}</td>
        <td><span class="badge badge-danger">${p.qty} পিস</span></td>
        <td>${fmt(p.unitPrice)}</td>
        <td><span class="badge badge-warning">⚠ Low Stock</span></td>
        <td><button class="btn btn-sm btn-primary" onclick="app.quickStockIn('${p.docId}')"><i class="fa-solid fa-plus"></i> স্টক যোগ</button></td>
      </tr>
    `).join('');
  }

  function renderCharts() {
    const isDark = STATE.theme === 'dark';
    const textColor = isDark ? '#9ca3af' : '#475569';
    const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';

    const sorted = [...STATE.parts].sort((a, b) => (b.qty * b.unitPrice) - (a.qty * a.unitPrice)).slice(0, 10);
    const ctx1 = document.getElementById('chartTopParts')?.getContext('2d');
    if (ctx1) {
      if (chartTopPartsInstance) chartTopPartsInstance.destroy();
      chartTopPartsInstance = new Chart(ctx1, {
        type: 'bar',
        data: {
          labels: sorted.map(p => p.description?.substring(0, 15) + '...'),
          datasets: [{ label: 'মোট মূল্য (৳)', data: sorted.map(p => p.qty * p.unitPrice), backgroundColor: 'rgba(99,102,241,0.75)', borderColor: '#6366f1', borderWidth: 1, borderRadius: 6 }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: textColor }, grid: { color: gridColor } }, y: { ticks: { color: textColor }, grid: { color: gridColor } } } }
      });
    }

    const typeCounts = {};
    STATE.parts.forEach(p => { const t = p.type || 'Other'; typeCounts[t] = (typeCounts[t] || 0) + p.qty; });
    const ctx2 = document.getElementById('chartTypeDistribution')?.getContext('2d');
    if (ctx2) {
      if (chartTypeInstance) chartTypeInstance.destroy();
      chartTypeInstance = new Chart(ctx2, {
        type: 'doughnut',
        data: { labels: Object.keys(typeCounts), datasets: [{ data: Object.values(typeCounts), backgroundColor: ['#6366f1','#10b981','#f59e0b','#8b5cf6','#ec4899','#3b82f6'] }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: textColor } } } }
      });
    }
  }

  // =====================================================
  // INVENTORY TABLE
  // =====================================================
  function getFilteredParts() {
    return STATE.parts.filter(p => {
      if (STATE.search) {
        const q = STATE.search.toLowerCase();
        if (!p.partNo?.toLowerCase().includes(q) && !p.description?.toLowerCase().includes(q) && !p.invoiceNo?.toLowerCase().includes(q) && !p.store?.toLowerCase().includes(q)) return false;
      }
      if (STATE.filterStore !== 'ALL' && p.store !== STATE.filterStore) return false;
      if (STATE.filterType !== 'ALL' && p.type !== STATE.filterType) return false;
      if (STATE.filterStatus === 'IN_STOCK' && p.qty <= 0) return false;
      if (STATE.filterStatus === 'LOW_STOCK' && (p.qty > 2 || p.qty === 0)) return false;
      if (STATE.filterStatus === 'OUT_OF_STOCK' && p.qty > 0) return false;
      return true;
    });
  }

  function renderInventoryTable() {
    const tbody = document.getElementById('inventoryTableBody');
    if (!tbody) return;
    const filtered = getFilteredParts();
    const totalVal = filtered.reduce((s, p) => s + p.qty * p.unitPrice, 0);

    document.getElementById('displayedCount').textContent = filtered.length;
    document.getElementById('totalCount').textContent = STATE.parts.length;
    document.getElementById('displayedValue').textContent = fmt(totalVal);

    const totalPages = Math.ceil(filtered.length / STATE.pageSize) || 1;
    if (STATE.currentPage > totalPages) STATE.currentPage = totalPages;
    const start = (STATE.currentPage - 1) * STATE.pageSize;
    const items = filtered.slice(start, start + STATE.pageSize);

    if (!items.length) {
      tbody.innerHTML = `<tr><td colspan="11" class="text-center p-4 text-muted">কোনো পার্টস পাওয়া যায়নি।</td></tr>`;
      renderPagination(0, 1);
      return;
    }

    tbody.innerHTML = items.map((p, i) => {
      let badge = '<span class="badge badge-success">Available</span>';
      if (p.qty === 0) badge = '<span class="badge badge-danger">Out of Stock</span>';
      else if (p.qty <= 2) badge = '<span class="badge badge-warning">Low Stock</span>';

      return `
        <tr>
          <td>${start + i + 1}</td>
          <td><strong>${esc(p.partNo)}</strong></td>
          <td>${esc(p.description)}</td>
          <td><span class="text-sub">${esc(p.store)}</span></td>
          <td>${esc(p.rcvDate || '-')}</td>
          <td>${esc(p.invoiceNo || '-')}</td>
          <td><strong class="${p.qty <= 2 ? 'text-amber' : ''}">${p.qty}</strong></td>
          <td>${fmt(p.unitPrice)}</td>
          <td><strong>${fmt(p.qty * p.unitPrice)}</strong></td>
          <td>${badge}</td>
          <td class="text-right">
            <button class="btn btn-sm btn-outline" onclick="app.quickStockIn('${p.docId}')" title="Stock In"><i class="fa-solid fa-plus text-emerald"></i></button>
            <button class="btn btn-sm btn-outline" onclick="app.quickStockOut('${p.docId}')" title="Stock Out"><i class="fa-solid fa-minus text-amber"></i></button>
            <button class="btn btn-sm btn-outline" onclick="app.editPart('${p.docId}')" title="Edit"><i class="fa-solid fa-pen text-indigo"></i></button>
            <button class="btn btn-sm btn-outline" onclick="app.deletePart('${p.docId}')" title="Delete"><i class="fa-solid fa-trash text-rose"></i></button>
          </td>
        </tr>`;
    }).join('');

    renderPagination(filtered.length, totalPages);
  }

  function renderPagination(total, totalPages) {
    const info = document.getElementById('paginationInfo');
    const ctrls = document.getElementById('paginationControls');
    if (info) info.textContent = `পৃষ্ঠা ${STATE.currentPage} এর ${totalPages} (মোট ${total}টি)`;
    if (!ctrls) return;
    if (totalPages <= 1) { ctrls.innerHTML = ''; return; }
    ctrls.innerHTML = `
      <button class="btn btn-sm btn-outline" ${STATE.currentPage === 1 ? 'disabled' : ''} onclick="app.changePage(${STATE.currentPage - 1})"><i class="fa-solid fa-chevron-left"></i> পূর্ববর্তী</button>
      <span class="px-3 font-semibold">${STATE.currentPage} / ${totalPages}</span>
      <button class="btn btn-sm btn-outline" ${STATE.currentPage === totalPages ? 'disabled' : ''} onclick="app.changePage(${STATE.currentPage + 1})">পরবর্তী <i class="fa-solid fa-chevron-right"></i></button>
    `;
  }

  // =====================================================
  // OWNER REPORTS
  // =====================================================
  function setReportMode(mode) {
    STATE.reportMode = mode;
    document.getElementById('btnModeDaily')?.classList.toggle('active', mode === 'daily');
    document.getElementById('btnModeMonthly')?.classList.toggle('active', mode === 'monthly');
    document.getElementById('groupDailyDate')?.classList.toggle('hidden', mode !== 'daily');
    document.getElementById('groupMonthlyDate')?.classList.toggle('hidden', mode !== 'monthly');
    generateOwnerReport();
  }

  function generateOwnerReport() {
    const titleEl = document.getElementById('printReportTitle');
    const periodEl = document.getElementById('printReportPeriod');
    const tbody = document.getElementById('reportTableBody');
    if (!tbody) return;

    if (STATE.reportMode === 'daily') {
      const d = document.getElementById('reportDailyDate')?.value || new Date().toISOString().split('T')[0];
      if (titleEl) titleEl.textContent = 'দৈনিক স্টক ও লেনদেন রিপোর্ট';
      if (periodEl) periodEl.textContent = `তারিখ: ${d}`;
    } else {
      const m = document.getElementById('reportMonth')?.value || (new Date().getMonth() + 1);
      const y = document.getElementById('reportYear')?.value || new Date().getFullYear();
      const months = ['','জানুয়ারি','ফেব্রুয়ারি','মার্চ','এপ্রিল','মে','জুন','জুলাই','আগস্ট','সেপ্টেম্বর','অক্টোবর','নভেম্বর','ডিসেম্বর'];
      if (titleEl) titleEl.textContent = 'মাসিক ইনভেন্টরি রিপোর্ট';
      if (periodEl) periodEl.textContent = `মাস: ${months[parseInt(m)]} ${y}`;
    }

    const selectedDate = document.getElementById('reportDailyDate')?.value;
    const selectedMonth = parseInt(document.getElementById('reportMonth')?.value || 0);
    const selectedYear = parseInt(document.getElementById('reportYear')?.value || 0);

    const items = STATE.parts.map((p, idx) => {
      let txs = STATE.transactions.filter(t => t.partNo === p.partNo);
      if (STATE.reportMode === 'daily' && selectedDate) txs = txs.filter(t => t.date === selectedDate);
      else if (STATE.reportMode === 'monthly') txs = txs.filter(t => { const d = new Date(t.date); return (d.getMonth()+1) === selectedMonth && d.getFullYear() === selectedYear; });

      const rcvQty = txs.filter(t => t.type === 'RECEIVE').reduce((s, t) => s + t.qty, 0);
      const issueQty = txs.filter(t => t.type === 'ISSUE').reduce((s, t) => s + t.qty, 0);
      return { sl: idx+1, partNo: p.partNo, description: p.description, invoiceNo: p.invoiceNo, type: p.type, unitPrice: p.unitPrice, rcvQty, issueQty, currentBal: p.qty, totalVal: p.qty * p.unitPrice };
    });

    let totRcv = 0, totIssued = 0, totBal = 0, totVal = 0;
    tbody.innerHTML = items.map(item => {
      totRcv += item.rcvQty; totIssued += item.issueQty; totBal += item.currentBal; totVal += item.totalVal;
      return `<tr>
        <td>${item.sl}</td><td><strong>${esc(item.partNo)}</strong></td><td>${esc(item.description)}</td>
        <td>${esc(item.invoiceNo||'-')}</td><td>${esc(item.type||'H')}</td><td>${fmt(item.unitPrice)}</td>
        <td class="text-emerald">+${item.rcvQty}</td><td class="text-amber">-${item.issueQty}</td>
        <td><strong>${item.currentBal}</strong></td><td><strong>${fmt(item.totalVal)}</strong></td>
      </tr>`;
    }).join('');

    document.getElementById('repOpeningQty').textContent = `${totBal - totRcv + totIssued} পিস`;
    document.getElementById('repReceivedQty').textContent = `+${totRcv} পিস`;
    document.getElementById('repIssuedQty').textContent = `-${totIssued} পিস`;
    document.getElementById('repClosingQty').textContent = `${totBal} পিস`;
    document.getElementById('repClosingValue').textContent = fmt(totVal);
    document.getElementById('repTotalRcvQty').textContent = `+${totRcv}`;
    document.getElementById('repTotalIssuedQty').textContent = `-${totIssued}`;
    document.getElementById('repTotalBalQty').textContent = totBal;
    document.getElementById('repTotalValSum').textContent = fmt(totVal);
  }

  // =====================================================
  // EXCEL IMPORT
  // =====================================================
  function setupExcelImportListeners() {
    const dropZone = document.getElementById('excelDropZone');
    const fileInput = document.getElementById('excelFileInput');
    const btnSelect = document.getElementById('btnSelectExcelFile');

    btnSelect?.addEventListener('click', () => fileInput?.click());
    fileInput?.addEventListener('change', e => { if (e.target.files[0]) processExcelFile(e.target.files[0]); });

    if (dropZone) {
      ['dragenter','dragover'].forEach(ev => dropZone.addEventListener(ev, e => { e.preventDefault(); dropZone.classList.add('drag-over'); }));
      ['dragleave','drop'].forEach(ev => dropZone.addEventListener(ev, e => { e.preventDefault(); dropZone.classList.remove('drag-over'); }));
      dropZone.addEventListener('drop', e => { if (e.dataTransfer.files[0]) processExcelFile(e.dataTransfer.files[0]); });
    }

    document.getElementById('btnConfirmImport')?.addEventListener('click', confirmImportData);
  }

  function processExcelFile(file) {
    document.getElementById('selectedFileName').textContent = `📄 ${file.name}`;
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json(ws, { header: 1 });
        if (raw.length <= 1) { showToast('ফাইলে ডাটা নেই!', 'error'); return; }

        const headers = raw[0].map(h => String(h||'').trim());
        const find = keys => headers.findIndex(h => keys.some(k => h.toLowerCase().includes(k.toLowerCase())));
        const iPartNo = find(['parts no','part no','part_no']);
        const iDesc = find(['description','desc','name']);
        const iStore = find(['store']);
        const iDate = find(['rcv date','date']);
        const iInv = find(['invoice','jc no']);
        const iType = find(['type']);
        const iQty = find(['qty','quantity']);
        const iPrice = find(['unit price','price']);

        const mapped = [];
        for (let i = 1; i < raw.length; i++) {
          const row = raw[i];
          if (!row || !row.length) continue;
          const partNo = iPartNo !== -1 ? String(row[iPartNo]||'').trim() : '';
          const desc = iDesc !== -1 ? String(row[iDesc]||'').trim() : '';
          if (!partNo && !desc) continue;
          const qty = iQty !== -1 ? parseInt(row[iQty])||1 : 1;
          const price = iPrice !== -1 ? parseFloat(String(row[iPrice]).replace(',',''))||0 : 0;
          mapped.push({
            sl: Date.now() + i,
            store: iStore !== -1 && row[iStore] ? String(row[iStore]).trim() : 'Moto Zone Workshop',
            partNo: partNo || `P-${i}`,
            rcvDate: iDate !== -1 && row[iDate] ? String(row[iDate]).trim() : new Date().toLocaleDateString(),
            invoiceNo: iInv !== -1 && row[iInv] ? String(row[iInv]).trim() : '',
            lcNo: '',
            description: desc || 'Parts Item',
            type: iType !== -1 && row[iType] ? String(row[iType]).trim() : 'H',
            qty, unitPrice: price, totalPrice: qty * price
          });
        }
        STATE.previewImportData = mapped;
        renderPreviewTable(mapped);
        showToast(`${mapped.length}টি রেকর্ড পাওয়া গেছে। ইম্পোর্ট নিশ্চিত করুন।`, 'success');
      } catch (err) {
        showToast('ফাইল পড়তে সমস্যা হয়েছে!', 'error');
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function renderPreviewTable(data) {
    const card = document.getElementById('previewCard');
    const tbody = document.getElementById('previewTableBody');
    if (!card || !tbody) return;
    document.getElementById('previewRecordCount').textContent = data.length;
    card.classList.remove('hidden');
    tbody.innerHTML = data.slice(0, 15).map(item => `
      <tr>
        <td><strong>${esc(item.partNo)}</strong></td><td>${esc(item.description)}</td>
        <td>${esc(item.store)}</td><td>${esc(item.rcvDate)}</td>
        <td>${esc(item.invoiceNo)}</td><td>${item.qty}</td>
        <td>${fmt(item.unitPrice)}</td><td><strong>${fmt(item.qty * item.unitPrice)}</strong></td>
      </tr>`).join('');
  }

  async function confirmImportData() {
    if (!STATE.previewImportData.length) return;
    const mode = document.querySelector('input[name="importMode"]:checked')?.value || 'append';
    const btn = document.getElementById('btnConfirmImport');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Firebase-এ সেভ হচ্ছে...'; }

    try {
      if (mode === 'replace') {
        // Delete all existing parts first
        const existing = await db.collection('parts').get();
        const delBatch = db.batch();
        existing.docs.forEach(d => delBatch.delete(d.ref));
        await delBatch.commit();
      }

      // Batch write new data
      const batchSize = 400;
      for (let i = 0; i < STATE.previewImportData.length; i += batchSize) {
        const batch = db.batch();
        STATE.previewImportData.slice(i, i + batchSize).forEach(item => {
          const ref = db.collection('parts').doc();
          batch.set(ref, { ...item, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
        });
        await batch.commit();
      }

      showToast(`${STATE.previewImportData.length}টি পার্টস Firebase-এ সফলভাবে সেভ হয়েছে! ✅`, 'success');
      STATE.previewImportData = [];
      document.getElementById('previewCard')?.classList.add('hidden');
      navigateTo('inventory');
    } catch (err) {
      showToast('ইম্পোর্ট করতে সমস্যা হয়েছে!', 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-check"></i> Firebase-এ সেভ করুন'; }
    }
  }

  // =====================================================
  // MODALS
  // =====================================================
  function openModal(id) { document.getElementById(id)?.classList.add('active'); }
  function closeModal(id) { document.getElementById(id)?.classList.remove('active'); }

  function openPartFormModal(docId = null) {
    const form = document.getElementById('formPart');
    if (!form) return;
    form.reset();

    if (docId) {
      const part = STATE.parts.find(p => p.docId === docId);
      if (part) {
        document.getElementById('modalPartTitle').innerHTML = '<i class="fa-solid fa-pen"></i> পার্টস এডিট করুন';
        document.getElementById('partId').value = part.docId;
        document.getElementById('inputPartNo').value = part.partNo || '';
        document.getElementById('inputDescription').value = part.description || '';
        document.getElementById('inputStore').value = part.store || 'Moto Zone Workshop';
        document.getElementById('inputRcvDate').value = part.rcvDate || '';
        document.getElementById('inputInvoiceNo').value = part.invoiceNo || '';
        document.getElementById('inputType').value = part.type || 'H';
        document.getElementById('inputQty').value = part.qty || 0;
        document.getElementById('inputUnitPrice').value = part.unitPrice || 0;
      }
    } else {
      document.getElementById('modalPartTitle').innerHTML = '<i class="fa-solid fa-box"></i> নতুন পার্টস যুক্ত করুন';
      document.getElementById('partId').value = '';
      document.getElementById('inputStore').value = 'Moto Zone Workshop';
      document.getElementById('inputRcvDate').value = new Date().toLocaleDateString('en-GB');
    }
    openModal('modalPartForm');
  }

  async function handlePartFormSubmit(e) {
    e.preventDefault();
    const docId = document.getElementById('partId').value;
    const partData = {
      partNo: document.getElementById('inputPartNo').value.trim(),
      description: document.getElementById('inputDescription').value.trim(),
      store: document.getElementById('inputStore').value.trim() || 'Moto Zone Workshop',
      rcvDate: document.getElementById('inputRcvDate').value.trim(),
      invoiceNo: document.getElementById('inputInvoiceNo').value.trim(),
      type: document.getElementById('inputType').value.trim() || 'H',
      qty: parseInt(document.getElementById('inputQty').value) || 0,
      unitPrice: parseFloat(document.getElementById('inputUnitPrice').value) || 0,
      sl: docId ? undefined : Date.now()
    };

    await savePartToFirestore(partData, docId || null);
    closeModal('modalPartForm');
  }

  function openStockTxModal(type = 'ISSUE', preselectDocId = null) {
    const sel = document.getElementById('txPartSelect');
    if (!sel) return;
    document.getElementById('txType').value = type;

    if (type === 'RECEIVE') {
      document.getElementById('modalTxTitle').innerHTML = '<i class="fa-solid fa-plus text-emerald"></i> স্টক রিসিভ এন্ট্রি (Stock In)';
      document.getElementById('txQtyLabel').textContent = 'রিসিভ পরিমাণ (পিস) *';
      document.getElementById('btnSubmitTx').className = 'btn btn-emerald';
    } else {
      document.getElementById('modalTxTitle').innerHTML = '<i class="fa-solid fa-minus text-amber"></i> সেলস / ইস্যু এন্ট্রি (Stock Out)';
      document.getElementById('txQtyLabel').textContent = 'বিক্রি / ইস্যু পরিমাণ (পিস) *';
      document.getElementById('btnSubmitTx').className = 'btn btn-primary';
    }

    sel.innerHTML = STATE.parts.map(p => `
      <option value="${p.docId}" ${preselectDocId === p.docId ? 'selected' : ''}>
        ${esc(p.partNo)} — ${esc(p.description)} (স্টক: ${p.qty} পিস)
      </option>`).join('');

    sel.onchange = updateTxPreview;
    updateTxPreview();
    openModal('modalStockTx');
  }

  function updateTxPreview() {
    const sel = document.getElementById('txPartSelect');
    const part = STATE.parts.find(p => p.docId === sel.value);
    if (part) {
      document.getElementById('txCurrentStock').textContent = `${part.qty} পিস`;
      document.getElementById('txUnitPrice').textContent = fmt(part.unitPrice);
    }
  }

  async function handleTxFormSubmit(e) {
    e.preventDefault();
    const type = document.getElementById('txType').value;
    const docId = document.getElementById('txPartSelect').value;
    const qty = parseInt(document.getElementById('txQty').value) || 1;
    const note = document.getElementById('txNote').value.trim();

    const part = STATE.parts.find(p => p.docId === docId);
    if (!part) return;

    if (type === 'ISSUE' && part.qty < qty) {
      showToast(`পর্যাপ্ত স্টক নেই! বর্তমান স্টক: ${part.qty} পিস`, 'error');
      return;
    }

    const newQty = type === 'ISSUE' ? part.qty - qty : part.qty + qty;

    await updatePartQtyInFirestore(docId, newQty, part.unitPrice);
    await saveTransaction({
      date: new Date().toISOString().split('T')[0],
      time: new Date().toLocaleTimeString(),
      type,
      partNo: part.partNo,
      description: part.description,
      qty,
      unitPrice: part.unitPrice,
      totalAmount: qty * part.unitPrice,
      note
    });

    closeModal('modalStockTx');
    showToast(`স্টক এন্ট্রি সফল! ${part.partNo} — ${type === 'ISSUE' ? '-' : '+'}${qty} পিস`, 'success');
  }

  async function deletePart(docId) {
    if (confirm('এই পার্টসটি স্থায়ীভাবে মুছে ফেলতে চান?')) {
      await deletePartFromFirestore(docId);
    }
  }

  // =====================================================
  // EXPORT
  // =====================================================
  function exportFilteredToExcel() {
    const items = getFilteredParts();
    if (!items.length) { showToast('এক্সপোর্ট করার মতো ডাটা নেই!', 'error'); return; }
    const data = items.map((p, i) => ({ 'SL': i+1, 'Store': p.store, 'Parts No': p.partNo, 'Description': p.description, 'RCV Date': p.rcvDate, 'Invoice/JC No': p.invoiceNo, 'Type': p.type, 'Qty': p.qty, 'Unit Price': p.unitPrice, 'Total Price': p.qty * p.unitPrice }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Stock');
    XLSX.writeFile(wb, `MotoZone_Stock_${new Date().toISOString().split('T')[0]}.xlsx`);
    showToast('Excel ফাইল ডাউনলোড হয়েছে! ✅', 'success');
  }

  function exportBackupJson() {
    const data = JSON.stringify({ parts: STATE.parts, transactions: STATE.transactions, exportedAt: new Date().toISOString() }, null, 2);
    const a = document.createElement('a');
    a.href = 'data:text/json;charset=utf-8,' + encodeURIComponent(data);
    a.download = `MotoZone_Backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    showToast('ব্যাকআপ ডাউনলোড হয়েছে! ✅', 'success');
  }

  // =====================================================
  // UTILITIES
  // =====================================================
  function fmt(amount) {
    return '৳ ' + (amount || 0).toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function esc(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function showToast(msg, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icons = { success: 'fa-circle-check text-emerald', error: 'fa-circle-xmark text-rose', info: 'fa-circle-info text-indigo' };
    toast.innerHTML = `<i class="fa-solid ${icons[type]||'fa-info'}"></i> <span>${esc(msg)}</span>`;
    container.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 4000);
  }

  // =====================================================
  // GLOBAL EXPORTS
  // =====================================================
  window.app = {
    navigateTo,
    quickStockIn: docId => openStockTxModal('RECEIVE', docId),
    quickStockOut: docId => openStockTxModal('ISSUE', docId),
    editPart: docId => openPartFormModal(docId),
    deletePart,
    changePage: page => { STATE.currentPage = page; renderInventoryTable(); }
  };

})();
