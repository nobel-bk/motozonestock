/* eslint-disable */
(() => {
  'use strict';

  // =====================================================
  // FIREBASE CONFIG
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
  const db   = firebase.firestore();

  // =====================================================
  // STATE
  // =====================================================
  const STATE = {
    parts: [],
    filtered: [],
    charts: {},
    reportMode: 'daily',
    pendingDeleteId: null
  };

  // =====================================================
  // THEME
  // =====================================================
  const savedTheme = localStorage.getItem('MOTO_THEME') || 'light';
  document.documentElement.className = savedTheme;

  document.addEventListener('DOMContentLoaded', () => {
    // Theme toggle
    document.getElementById('btnThemeToggle')?.addEventListener('click', () => {
      const isDark = document.documentElement.classList.contains('dark');
      document.documentElement.className = isDark ? 'light' : 'dark';
      localStorage.setItem('MOTO_THEME', isDark ? 'light' : 'dark');
    });

    // Init report date
    const dateInput = document.getElementById('reportDailyDate');
    if (dateInput) dateInput.value = new Date().toISOString().slice(0, 10);

    // Init report buttons
    initReportButtons();
  });

  // =====================================================
  // AUTH
  // =====================================================
  auth.onAuthStateChanged(user => {
    if (user) {
      document.getElementById('authGate')?.classList.add('hidden');
      document.getElementById('mainApp')?.classList.remove('hidden');
      const emailEl = document.getElementById('userEmailDisplay');
      if (emailEl) emailEl.textContent = user.email;
      startApp();
    } else {
      document.getElementById('authGate')?.classList.remove('hidden');
      document.getElementById('mainApp')?.classList.add('hidden');
      window.location.href = 'login.html';
    }
  });

  document.getElementById('btnLogout')?.addEventListener('click', () => {
    auth.signOut();
  });

  // =====================================================
  // START APP
  // =====================================================
  function startApp() {
    initTabs();
    initStockTab();
    initImportTab();
    initDashQuickActions();
    loadParts();
  }

  function initDashQuickActions() {
    const dateStrEl = document.getElementById('dashDateStr');
    if (dateStrEl) {
      const now = new Date();
      dateStrEl.textContent = 'আজ: ' + now.toLocaleDateString('bn-BD', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    }

    const nameEl = document.getElementById('dashUserName');
    if (nameEl && auth.currentUser) {
      nameEl.textContent = auth.currentUser.email ? auth.currentUser.email.split('@')[0] : 'Manager';
    }

    const switchTab = (tabName) => {
      document.querySelectorAll('.tab-btn').forEach(b => {
        if (b.dataset.tab === tabName) b.classList.add('active');
        else b.classList.remove('active');
      });
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
      document.getElementById('tab-' + tabName)?.classList.remove('hidden');
    };

    document.getElementById('btnDashAddPart')?.addEventListener('click', () => {
      switchTab('stock');
      document.getElementById('btnAddPart')?.click();
    });
    document.getElementById('btnDashGoImport')?.addEventListener('click', () => switchTab('import'));
    document.getElementById('btnDashGoReport')?.addEventListener('click', () => switchTab('reports'));
  }

  // =====================================================
  // TAB NAVIGATION
  // =====================================================
  function initTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
        btn.classList.add('active');
        const tabId = 'tab-' + btn.dataset.tab;
        document.getElementById(tabId)?.classList.remove('hidden');
      });
    });
  }

  // =====================================================
  // FIRESTORE: LOAD PARTS (REAL-TIME)
  // =====================================================
  function loadParts() {
    db.collection('parts').orderBy('sl').onSnapshot(snap => {
      STATE.parts = snap.docs.map(doc => ({ docId: doc.id, ...doc.data() }));
      STATE.filtered = [...STATE.parts];
      renderAll();
    }, err => {
      // Try without ordering if index missing
      db.collection('parts').onSnapshot(snap => {
        STATE.parts = snap.docs.map(doc => ({ docId: doc.id, ...doc.data() }));
        STATE.filtered = [...STATE.parts];
        renderAll();
      });
    });
  }

  function renderAll() {
    renderKPIs();
    renderStockTable(STATE.filtered);
    renderCharts();
    renderLowStockAlert();
    renderDashTopValueTable();
  }

  // =====================================================
  // KPIs
  // =====================================================
  function renderKPIs() {
    const parts = STATE.parts;
    const totalItems = parts.length;
    const totalStock = parts.reduce((s, p) => s + (parseInt(p.qty) || 0), 0);
    const lowStock = parts.filter(p => (parseInt(p.qty) || 0) <= 2).length;
    const totalValue = parts.reduce((s, p) => s + ((parseInt(p.qty) || 0) * (parseFloat(p.unitPrice) || 0)), 0);

    const g = id => document.getElementById(id);
    if (g('kpiTotalParts')) g('kpiTotalParts').textContent = totalItems.toLocaleString();
    if (g('kpiTotalStock')) g('kpiTotalStock').textContent = totalStock.toLocaleString();
    if (g('kpiLowStock'))   g('kpiLowStock').textContent   = lowStock;
    if (g('kpiTotalValue')) g('kpiTotalValue').textContent = '৳' + Math.round(totalValue).toLocaleString();
    if (g('lowStockCount')) g('lowStockCount').textContent = lowStock;
  }

  // =====================================================
  // LOW STOCK ALERT
  // =====================================================
  function renderLowStockAlert() {
    const listEl = document.getElementById('lowStockList');
    if (!listEl) return;

    const lowItems = STATE.parts.filter(p => (parseInt(p.qty) || 0) <= 2);
    if (lowItems.length === 0) {
      listEl.innerHTML = '<p style="padding:16px;text-align:center;color:#10b981;font-size:0.85rem;"><i class="fa-solid fa-circle-check"></i> সব পার্টস পর্যাপ্ত পরিমাণে স্টকে আছে!</p>';
      return;
    }

    listEl.innerHTML = lowItems.map(p => {
      const q = parseInt(p.qty) || 0;
      const bClass = q === 0 ? 'badge-red' : 'badge-amber';
      return `<div style="padding:10px 14px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;gap:8px;">
        <div>
          <strong style="font-size:0.82rem;display:block;">${p.partNo}</strong>
          <span style="font-size:0.78rem;color:var(--text-sub);">${p.description || '-'}</span>
        </div>
        <span class="badge ${bClass}">${q === 0 ? 'আউট অব স্টক' : q + ' পিস বাকি'}</span>
      </div>`;
    }).join('');
  }

  function renderDashTopValueTable() {
    const tbody = document.getElementById('dashTopValueTable');
    if (!tbody) return;

    const topValueParts = [...STATE.parts]
      .map(p => ({ ...p, totalVal: (parseInt(p.qty) || 0) * (parseFloat(p.unitPrice) || 0) }))
      .sort((a, b) => b.totalVal - a.totalVal)
      .slice(0, 6);

    if (topValueParts.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:20px;color:#94a3b8;">কোনো ডাটা নেই</td></tr>';
      return;
    }

    tbody.innerHTML = topValueParts.map(p => `
      <tr>
        <td><strong>${p.partNo}</strong></td>
        <td>${p.description ? p.description.slice(0, 20) + '...' : '-'}</td>
        <td style="text-align:center;">${p.qty || 0}</td>
        <td><strong>৳ ${Math.round(p.totalVal).toLocaleString()}</strong></td>
      </tr>
    `).join('');
  }

  // =====================================================
  // STOCK TABLE
  // =====================================================
  function renderStockTable(parts) {
    const tbody = document.getElementById('partsTableBody');
    const countEl = document.getElementById('tableCount');
    if (!tbody) return;

    if (parts.length === 0) {
      tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:40px;color:#94a3b8;">কোনো পার্টস পাওয়া যায়নি</td></tr>';
      if (countEl) countEl.textContent = '০টি পার্টস';
      return;
    }

    tbody.innerHTML = parts.map((p, idx) => {
      const qty = parseInt(p.qty) || 0;
      const badge = qty === 0 ? 'badge-red' : qty <= 2 ? 'badge-amber' : 'badge-green';
      const badgeLabel = qty === 0 ? 'আউট অব স্টক' : qty <= 2 ? 'লো স্টক' : 'ইন স্টক';
      const total = qty * (parseFloat(p.unitPrice) || 0);

      return `<tr>
        <td style="color:#94a3b8;">${idx + 1}</td>
        <td><strong>${p.partNo || '-'}</strong></td>
        <td>${p.description || '-'}</td>
        <td>${p.store || '-'}</td>
        <td>
          <div class="stock-adj">
            <button class="btn-adj" onclick="adjustStock('${p.docId}', -1)">−</button>
            <span class="qty-display">${qty}</span>
            <button class="btn-adj" onclick="adjustStock('${p.docId}', 1)">+</button>
          </div>
          <span class="badge ${badge}" style="margin-left:4px;">${badgeLabel}</span>
        </td>
        <td>৳${(parseFloat(p.unitPrice) || 0).toLocaleString()}</td>
        <td><strong>৳${Math.round(total).toLocaleString()}</strong></td>
        <td>${p.rcvDate || '-'}</td>
        <td style="font-size:0.75rem;color:#94a3b8;">${p.invoiceNo || '-'}</td>
        <td>
          <div style="display:flex;gap:4px;">
            <button class="btn btn-sm btn-outline btn-icon" onclick="editPart('${p.docId}')" title="এডিট"><i class="fa-solid fa-pen"></i></button>
            <button class="btn btn-sm btn-danger btn-icon" onclick="confirmDelete('${p.docId}','${(p.partNo||'').replace(/'/g,"\\'")}'))" title="ডিলিট"><i class="fa-solid fa-trash"></i></button>
          </div>
        </td>
      </tr>`;
    }).join('');

    if (countEl) countEl.textContent = `${parts.length}টি পার্টস দেখাচ্ছে`;

    // Rebuild store filter
    const stores = [...new Set(STATE.parts.map(p => p.store).filter(Boolean))];
    const filterEl = document.getElementById('filterStore');
    if (filterEl) {
      const cur = filterEl.value;
      filterEl.innerHTML = '<option value="">সব স্টোর</option>' +
        stores.map(s => `<option value="${s}" ${s === cur ? 'selected' : ''}>${s}</option>`).join('');
    }
  }

  // =====================================================
  // CHARTS
  // =====================================================
  function renderCharts() {
    // Top 10 by stock
    const topParts = [...STATE.parts]
      .sort((a, b) => (parseInt(b.qty) || 0) - (parseInt(a.qty) || 0))
      .slice(0, 10);

    const ctx1 = document.getElementById('chartTopParts');
    if (ctx1) {
      if (STATE.charts.top) STATE.charts.top.destroy();
      STATE.charts.top = new Chart(ctx1, {
        type: 'bar',
        data: {
          labels: topParts.map(p => p.partNo ? p.partNo.slice(0, 10) : 'N/A'),
          datasets: [{
            label: 'স্টক পরিমাণ',
            data: topParts.map(p => parseInt(p.qty) || 0),
            backgroundColor: 'rgba(225, 29, 72, 0.85)',
            borderRadius: 6,
            barThickness: 22
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                title: items => {
                  const idx = items[0].dataIndex;
                  return `${topParts[idx].partNo}: ${topParts[idx].description || ''}`;
                }
              }
            }
          },
          scales: {
            y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { font: { size: 11 } } },
            x: { grid: { display: false }, ticks: { font: { size: 10 } } }
          }
        }
      });
    }

    // Stock status pie
    const inStock = STATE.parts.filter(p => (parseInt(p.qty) || 0) > 2).length;
    const lowStock = STATE.parts.filter(p => { const q = parseInt(p.qty)||0; return q > 0 && q <= 2; }).length;
    const outStock = STATE.parts.filter(p => (parseInt(p.qty) || 0) === 0).length;

    const ctx2 = document.getElementById('chartStockStatus');
    if (ctx2) {
      if (STATE.charts.pie) STATE.charts.pie.destroy();
      STATE.charts.pie = new Chart(ctx2, {
        type: 'doughnut',
        data: {
          labels: ['ইন স্টক', 'লো স্টক', 'আউট অব স্টক'],
          datasets: [{
            data: [inStock, lowStock, outStock],
            backgroundColor: ['#10b981', '#f59e0b', '#e11d48'],
            borderWidth: 0
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { position: 'bottom' } },
          cutout: '65%'
        }
      });
    }
  }

  // =====================================================
  // STOCK TAB: SEARCH & FILTER
  // =====================================================
  function initStockTab() {
    document.getElementById('searchInput')?.addEventListener('input', filterParts);
    document.getElementById('filterStore')?.addEventListener('change', filterParts);

    document.getElementById('btnAddPart')?.addEventListener('click', () => {
      document.getElementById('formPart')?.reset();
      document.getElementById('partId').value = '';
      document.getElementById('modalPartTitle').textContent = 'নতুন পার্টস যুক্ত করুন';
      document.getElementById('inputStore').value = 'Moto Zone Workshop';
      document.getElementById('inputRcvDate').value = new Date().toISOString().slice(0, 10);
      openModal('modalPartForm');
    });

    document.getElementById('btnSavePart')?.addEventListener('click', savePart);

    document.getElementById('btnConfirmDelete')?.addEventListener('click', async () => {
      if (!STATE.pendingDeleteId) return;
      try {
        await db.collection('parts').doc(STATE.pendingDeleteId).delete();
        closeModal('modalConfirmDelete');
        showToast('পার্টস ডিলিট করা হয়েছে', 'info');
        STATE.pendingDeleteId = null;
      } catch (e) {
        showToast('ডিলিট করতে সমস্যা হয়েছে!', 'error');
      }
    });

    document.getElementById('btnExportExcel')?.addEventListener('click', exportToExcel);
  }

  function filterParts() {
    const q = (document.getElementById('searchInput')?.value || '').toLowerCase();
    const store = document.getElementById('filterStore')?.value || '';
    STATE.filtered = STATE.parts.filter(p => {
      const matchQ = !q || (p.partNo || '').toLowerCase().includes(q) ||
                     (p.description || '').toLowerCase().includes(q) ||
                     (p.store || '').toLowerCase().includes(q);
      const matchStore = !store || p.store === store;
      return matchQ && matchStore;
    });
    renderStockTable(STATE.filtered);
  }

  // =====================================================
  // SAVE PART
  // =====================================================
  async function savePart() {
    const docId = document.getElementById('partId').value;
    const data = {
      partNo:      document.getElementById('inputPartNo').value.trim(),
      description: document.getElementById('inputDescription').value.trim(),
      store:       document.getElementById('inputStore').value.trim() || 'Moto Zone Workshop',
      qty:         parseInt(document.getElementById('inputQty').value) || 0,
      unitPrice:   parseFloat(document.getElementById('inputUnitPrice').value) || 0,
      invoiceNo:   document.getElementById('inputInvoiceNo').value.trim(),
      rcvDate:     document.getElementById('inputRcvDate').value,
    };
    if (!data.partNo) { showToast('Parts No দিন!', 'error'); return; }

    try {
      if (docId) {
        await db.collection('parts').doc(docId).update({ ...data, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
        showToast('পার্টস আপডেট হয়েছে ✅', 'success');
      } else {
        await db.collection('parts').add({ ...data, sl: Date.now(), createdAt: firebase.firestore.FieldValue.serverTimestamp() });
        showToast('নতুন পার্টস যুক্ত হয়েছে ✅', 'success');
      }
      closeModal('modalPartForm');
    } catch (e) {
      showToast('সেভ করতে সমস্যা হয়েছে!', 'error');
    }
  }

  // =====================================================
  // EDIT / DELETE
  // =====================================================
  window.editPart = function(docId) {
    const p = STATE.parts.find(x => x.docId === docId);
    if (!p) return;
    document.getElementById('partId').value = docId;
    document.getElementById('inputPartNo').value = p.partNo || '';
    document.getElementById('inputDescription').value = p.description || '';
    document.getElementById('inputStore').value = p.store || 'Moto Zone Workshop';
    document.getElementById('inputQty').value = p.qty || 0;
    document.getElementById('inputUnitPrice').value = p.unitPrice || 0;
    document.getElementById('inputInvoiceNo').value = p.invoiceNo || '';
    document.getElementById('inputRcvDate').value = p.rcvDate || '';
    document.getElementById('modalPartTitle').textContent = 'পার্টস এডিট করুন';
    openModal('modalPartForm');
  };

  window.confirmDelete = function(docId, label) {
    STATE.pendingDeleteId = docId;
    const el = document.getElementById('deletePartLabel');
    if (el) el.textContent = label;
    openModal('modalConfirmDelete');
  };

  window.adjustStock = async function(docId, delta) {
    const p = STATE.parts.find(x => x.docId === docId);
    if (!p) return;
    const newQty = Math.max(0, (parseInt(p.qty) || 0) + delta);
    try {
      await db.collection('parts').doc(docId).update({ qty: newQty });
      showToast(`${p.partNo}: স্টক ${delta > 0 ? '+' + delta : delta} → ${newQty} পিস`, delta > 0 ? 'success' : 'info');
    } catch (e) {
      showToast('স্টক আপডেটে সমস্যা হয়েছে!', 'error');
    }
  };

  // =====================================================
  // EXPORT TO EXCEL
  // =====================================================
  function exportToExcel() {
    if (!STATE.parts.length) { showToast('কোনো ডাটা নেই!', 'error'); return; }
    const rows = STATE.parts.map(p => ({
      'SL': p.sl || '',
      'Parts No': p.partNo || '',
      'Description': p.description || '',
      'Store': p.store || '',
      'Qty': p.qty || 0,
      'Unit Price': p.unitPrice || 0,
      'Total Price': (parseInt(p.qty)||0) * (parseFloat(p.unitPrice)||0),
      'Invoice No': p.invoiceNo || '',
      'RCV Date': p.rcvDate || ''
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Stock');
    XLSX.writeFile(wb, 'MS_Moto_Zone_Stock_' + new Date().toISOString().slice(0,10) + '.xlsx');
    showToast('Excel ফাইল ডাউনলোড হয়েছে ✅', 'success');
  }

  // =====================================================
  // EXCEL IMPORT (SMART SYNC)
  // =====================================================
  // =====================================================
  // EXCEL IMPORT (SMART SYNC)
  // =====================================================
  function initImportTab() {
    const dropZone = document.getElementById('excelDropZone');
    const fileInput = document.getElementById('excelFileInput');

    document.getElementById('btnSelectExcelFile')?.addEventListener('click', e => {
      e.stopPropagation();
      fileInput?.click();
    });

    fileInput?.addEventListener('change', e => onFileSelected(e.target.files[0]));

    dropZone?.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
    dropZone?.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone?.addEventListener('drop', e => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
      onFileSelected(e.dataTransfer.files[0]);
    });

    document.getElementById('btnStartImport')?.addEventListener('click', () => {
      if (STATE.selectedFile) {
        processExcelFile(STATE.selectedFile);
      } else {
        showToast('প্রথমে একটি Excel ফাইল নির্বাচন করুন!', 'error');
      }
    });
  }

  function onFileSelected(file) {
    if (!file) return;
    STATE.selectedFile = file;
    const nameEl = document.getElementById('selectedFileName');
    const boxEl  = document.getElementById('importActionBox');
    if (nameEl) nameEl.textContent = '📂 ' + file.name + ` (${(file.size / 1024).toFixed(1)} KB)`;
    if (boxEl)  boxEl.style.display = 'block';
    showToast(`ফাইল তৈরি: ${file.name}। এখন 'সিঙ্ক ও আপলোড শুরু করুন' বাটনে চাপ দিন।`, 'info');
  }

  async function processExcelFile(file) {
    if (!file) return;
    const importMode    = document.querySelector('input[name="importMode"]:checked')?.value  || 'smart_sync';
    const syncQtyMethod = document.querySelector('input[name="syncQtyMethod"]:checked')?.value || 'add';

    const btnStart = document.getElementById('btnStartImport');
    if (btnStart) {
      btnStart.disabled = true;
      btnStart.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> আপলোড ও সিঙ্ক হচ্ছে...';
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, { type: 'array' });
        const sheetName = wb.SheetNames[0];
        const sheet = wb.Sheets[sheetName];

        // DYNAMIC HEADER DETECTION
        // Scan first 20 rows to find header row (contains Material Code / Parts No / Description)
        const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        let headerRowIndex = 0;
        for (let r = 0; r < Math.min(rawRows.length, 20); r++) {
          const rowStr = (rawRows[r] || []).map(cell => (cell || '').toString().toLowerCase()).join(' ');
          if (
            rowStr.includes('material code') ||
            rowStr.includes('parts no') ||
            rowStr.includes('part no') ||
            rowStr.includes('materialcode') ||
            rowStr.includes('unrestricted stock')
          ) {
            headerRowIndex = r;
            break;
          }
        }

        const json = XLSX.utils.sheet_to_json(sheet, { range: headerRowIndex });

        if (!json.length) {
          showToast('ফাইলে কোনো ডাটা পাওয়া যায়নি! ফাইল ফরম্যাট চেক করুন।', 'error');
          if (btnStart) { btnStart.disabled = false; btnStart.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> সিঙ্ক ও আপলোড শুরু করুন'; }
          return;
        }

        showToast(`⏳ ${json.length}টি রেকর্ড স্ক্যান ও প্রসেস করা হচ্ছে...`, 'info');

        // Build existing map
        const existingMap = new Map();
        STATE.parts.forEach(p => {
          if (p.partNo) existingMap.set(p.partNo.toString().trim().toUpperCase(), p);
        });

        // Replace: clear existing collection first
        if (importMode === 'replace') {
          const snap = await db.collection('parts').get();
          const delBatch = db.batch();
          snap.docs.forEach(doc => delBatch.delete(doc.ref));
          await delBatch.commit();
          existingMap.clear();
        }

        let added = 0, updated = 0;

        // Process in batches of 400
        for (let i = 0; i < json.length; i += 400) {
          const batch = db.batch();
          const chunk = json.slice(i, i + 400);

          chunk.forEach(item => {
            const partNoRaw = (
              item['Material Code'] || item['Parts No'] || item['Part No'] ||
              item.partNo || item['MaterialCode'] || ''
            ).toString().trim();

            if (!partNoRaw || partNoRaw === 'Material Code' || partNoRaw === 'Parts No' || partNoRaw === 'SL.') return;

            const key = partNoRaw.toUpperCase();
            const itemQty = parseInt(
              item['Unrestricted Stock'] || item['Qty'] || item.qty || item['Stock Qty'] || 0
            ) || 0;

            const unitPrice = parseFloat(
              item['Sales Price (BDT)'] || item['Dealer Price (BDT)'] || item['Unit Price'] || item.unitPrice || 0
            ) || 0;

            const description = item['Description'] || item.description || '';
            const store       = item['Store'] || item.store || 'Moto Zone Workshop';
            const rcvDate     = item['RCV Date'] || item['Date'] || item.rcvDate || '';
            const invoiceNo   = item['Invoice/JC No'] || item['Invoice No'] || item.invoiceNo || '';

            if (importMode === 'smart_sync' && existingMap.has(key)) {
              const existing = existingMap.get(key);
              const finalQty = syncQtyMethod === 'add'
                ? (parseInt(existing.qty) || 0) + itemQty
                : itemQty;

              batch.update(db.collection('parts').doc(existing.docId), {
                qty: finalQty,
                unitPrice: unitPrice > 0 ? unitPrice : (existing.unitPrice || 0),
                description: description || existing.description,
                rcvDate: rcvDate || existing.rcvDate,
                invoiceNo: invoiceNo || existing.invoiceNo,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
              });
              updated++;
            } else {
              batch.set(db.collection('parts').doc(), {
                partNo: partNoRaw,
                description: description,
                store: store,
                qty: itemQty,
                unitPrice: unitPrice,
                rcvDate: rcvDate,
                invoiceNo: invoiceNo,
                sl: Date.now() + Math.random()
              });
              added++;
            }
          });

          await batch.commit();
        }

        let msg = '🎉 সিঙ্ক সম্পন্ন!';
        if (added)   msg += ` 🟢 ${added}টি নতুন পার্টস যুক্ত।`;
        if (updated) msg += ` 🔄 ${updated}টি পার্টসের স্টক আপডেট (${syncQtyMethod === 'add' ? 'যোগফল' : 'সেট'} মোড)।`;
        showToast(msg, 'success');

        // Reset UI
        STATE.selectedFile = null;
        const boxEl = document.getElementById('importActionBox');
        if (boxEl) boxEl.style.display = 'none';

        // Automatically switch to Dashboard tab to see updated numbers!
        document.querySelectorAll('.tab-btn').forEach(b => {
          if (b.dataset.tab === 'dashboard') b.classList.add('active');
          else b.classList.remove('active');
        });
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
        document.getElementById('tab-dashboard')?.classList.remove('hidden');

      } catch (err) {
        console.error('Import error:', err);
        showToast('ফাইল প্রসেসিংয়ে সমস্যা হয়েছে! ফাইলটি সঠিক Excel ফরম্যাট কি না তা চেক করুন।', 'error');
      } finally {
        if (btnStart) {
          btnStart.disabled = false;
          btnStart.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> সিঙ্ক ও আপলোড শুরু করুন';
        }
      }
    };
    reader.readAsArrayBuffer(file);
  }
        if (updated) msg += ` 🔄 ${updated}টি পার্টস আপডেট (${syncQtyMethod === 'add' ? 'যোগফল' : 'সেট'} মোড)।`;
        showToast(msg, 'success');
        if (nameEl) nameEl.textContent = '';
      } catch (err) {
        console.error(err);
        showToast('ফাইল প্রক্রিয়াকরণে সমস্যা! ফরম্যাট চেক করুন।', 'error');
      }
    };
    reader.readAsArrayBuffer(file);
  }

  // =====================================================
  // REPORT / INVOICE GENERATOR
  // =====================================================
  function numberToWords(num) {
    const a = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine',
      'Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
    const b = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
    if (num === 0) return 'Zero';
    if (num < 0) return 'Minus ' + numberToWords(-num);
    let words = '';
    if (Math.floor(num/1000) > 0) { words += numberToWords(Math.floor(num/1000)) + ' Thousand '; num %= 1000; }
    if (Math.floor(num/100)  > 0) { words += a[Math.floor(num/100)] + ' Hundred '; num %= 100; }
    if (num > 0) { words += num < 20 ? a[num] : b[Math.floor(num/10)] + (num%10 ? ' '+a[num%10] : ''); }
    return words.trim();
  }

  function renderReport() {
    const tbody = document.getElementById('reportTableBody');
    if (!tbody) return;

    const now = new Date();
    const g = id => document.getElementById(id);
    if (g('printCurrentDate')) g('printCurrentDate').textContent =
      now.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });

    const mode = STATE.reportMode || 'daily';
    if (g('printReportTitle')) g('printReportTitle').textContent =
      mode === 'daily' ? 'Daily Inventory Report' : 'Monthly Inventory Report';

    let totalAmt = 0, totalQty = 0;
    tbody.innerHTML = STATE.parts.map((p, idx) => {
      const qty  = parseInt(p.qty) || 0;
      const price = parseFloat(p.unitPrice) || 0;
      const line = qty * price;
      totalAmt += line; totalQty += qty;
      return `<tr>
        <td style="text-align:center">${idx+1}</td>
        <td><strong>${p.partNo||'-'}</strong></td>
        <td>${p.description||'-'}</td>
        <td>${p.store||'-'}</td>
        <td>${p.rcvDate||'-'}</td>
        <td style="text-align:right">${price.toLocaleString()} Tk</td>
        <td style="text-align:center">${qty}</td>
        <td style="text-align:right"><strong>${Math.round(line).toLocaleString()} Tk</strong></td>
      </tr>`;
    }).join('');

    if (g('rptTotalPartsAmount')) g('rptTotalPartsAmount').textContent = Math.round(totalAmt).toLocaleString() + ' Tk';
    if (g('rptTotalStockPcs'))    g('rptTotalStockPcs').textContent    = totalQty + ' pcs';
    if (g('rptFinalBillAmount'))  g('rptFinalBillAmount').textContent  = Math.round(totalAmt).toLocaleString() + ' Tk.';
    if (g('rptAmountInWords'))    g('rptAmountInWords').textContent    = 'Tk. ' + numberToWords(Math.round(totalAmt)) + ' Only.';

    showToast('✅ রিপোর্ট প্রস্তুত! PDF Download বা Print করুন।', 'success');
  }

  function initReportButtons() {
    document.getElementById('btnPrintReport')?.addEventListener('click', () => {
      renderReport();
      setTimeout(() => window.print(), 350);
    });

    document.getElementById('btnDownloadPdfReport')?.addEventListener('click', () => {
      renderReport();
      setTimeout(() => {
        const el = document.getElementById('printableReport');
        const today = new Date().toISOString().slice(0, 10);
        const opt = {
          margin: [8,8,8,8],
          filename: 'MS_Moto_Zone_Report_' + today + '.pdf',
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, logging: false },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        if (typeof html2pdf !== 'undefined') {
          showToast('⏳ PDF তৈরি হচ্ছে...', 'info');
          html2pdf().set(opt).from(el).save().then(() => showToast('✅ PDF ডাউনলোড সম্পন্ন!', 'success'));
        } else {
          window.print();
        }
      }, 400);
    });

    document.getElementById('btnGenerateReport')?.addEventListener('click', renderReport);

    document.getElementById('btnModeDaily')?.addEventListener('click', () => {
      STATE.reportMode = 'daily';
      document.getElementById('btnModeDaily')?.classList.add('active');
      document.getElementById('btnModeMonthly')?.classList.remove('active');
      renderReport();
    });
    document.getElementById('btnModeMonthly')?.addEventListener('click', () => {
      STATE.reportMode = 'monthly';
      document.getElementById('btnModeMonthly')?.classList.add('active');
      document.getElementById('btnModeDaily')?.classList.remove('active');
      renderReport();
    });
  }

  // =====================================================
  // MODAL HELPERS
  // =====================================================
  window.openModal  = id => document.getElementById(id)?.classList.remove('hidden');
  window.closeModal = id => document.getElementById(id)?.classList.add('hidden');

  // Close modal on overlay click
  document.querySelectorAll('.modal-overlay')?.forEach(overlay => {
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.add('hidden'); });
  });

  // =====================================================
  // TOAST
  // =====================================================
  function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icons = { success: 'fa-circle-check', error: 'fa-circle-exclamation', info: 'fa-circle-info' };
    toast.innerHTML = `<i class="fa-solid ${icons[type] || icons.info}"></i> <span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 4500);
  }

})();
