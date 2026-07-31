/**
 * MS Moto Zone - Hero Motorcycle Dealership & Authorized Service Center
 * Complete Application & Inventory Engine
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
    customerPartsSearch: '',
    filterStore: 'ALL',
    filterType: 'ALL',
    filterStatus: 'ALL',
    currentPage: 1,
    pageSize: 25,
    activePortalTab: 'dashboard',
    reportMode: 'daily',
    previewImportData: [],
    theme: localStorage.getItem('MOTO_THEME') || 'light',
    unsubscribeParts: null,
    activeBikeCategory: 'ALL'
  };

  let chartTopPartsInstance = null;
  let chartTypeInstance = null;

  // =====================================================
  // HERO MOTORCYCLE DATASET
  // =====================================================
  const HERO_BIKES = [
    {
      id: 'karizma-xmr',
      name: 'Hero Karizma XMR 210',
      subtitle: 'Legendary Flagship Sports Bike',
      category: 'SPORTS',
      price: 399990,
      engine: '210 cc',
      power: '25.5 PS @ 9250 RPM',
      mileage: '35 kmpl',
      braking: 'Dual ABS',
      icon: 'fa-motorcycle',
      badge: 'Sports / Flagship'
    },
    {
      id: 'xtreme-125r',
      name: 'Hero Xtreme 125R',
      subtitle: 'Sprint EBT Engine & ABS in 125cc',
      category: 'SPORTS',
      price: 171000,
      engine: '125 cc',
      power: '11.55 PS',
      mileage: '66 kmpl',
      braking: 'Single ABS / IBS',
      icon: 'fa-motorcycle',
      badge: 'Best Seller'
    },
    {
      id: 'mavrick-440',
      name: 'Hero Mavrick 440',
      subtitle: 'Torq-X Engine & All-LED Premium Roadster',
      category: 'PREMIUM',
      price: 450000,
      engine: '440 cc',
      power: '27.35 PS @ 6000 RPM',
      mileage: '30 kmpl',
      braking: 'Dual Channel ABS',
      icon: 'fa-motorcycle',
      badge: '440cc Monster'
    },
    {
      id: 'thriller-160r',
      name: 'Hero Thriller 160R 4V',
      subtitle: 'KYB Inverted USD Front Forks & 4V Engine',
      category: 'SPORTS',
      price: 210000,
      engine: '163 cc',
      power: '16.9 PS',
      mileage: '42 kmpl',
      braking: 'Petal Disc + ABS',
      icon: 'fa-motorcycle',
      badge: 'Sports 4V'
    },
    {
      id: 'splendor-xtec',
      name: 'Hero Splendor+ XTEC',
      subtitle: 'i3S Tech, Digital Meter & Bluetooth',
      category: 'COMMUTER',
      price: 121500,
      engine: '100 cc',
      power: '7.9 PS',
      mileage: '70+ kmpl',
      braking: 'IBS System',
      icon: 'fa-motorcycle',
      badge: 'Highest Mileage'
    },
    {
      id: 'glamour-xtec',
      name: 'Hero Glamour XTEC',
      subtitle: 'Real-Time Mileage Indicator & LED Headlamp',
      category: 'COMMUTER',
      price: 142000,
      engine: '125 cc',
      power: '10.7 PS',
      mileage: '60 kmpl',
      braking: 'IBS / Disc',
      icon: 'fa-motorcycle',
      badge: 'Executive Commuter'
    },
    {
      id: 'xpulse-200-4v',
      name: 'Hero Xpulse 200 4V',
      subtitle: 'Adventure On & Off-Road Companion',
      category: 'PREMIUM',
      price: 245000,
      engine: '200 cc',
      power: '19.1 PS',
      mileage: '38 kmpl',
      braking: 'Single ABS',
      icon: 'fa-motorcycle',
      badge: 'Adventure 4V'
    },
    {
      id: 'pleasure-xtec',
      name: 'Hero Pleasure+ XTEC',
      subtitle: 'Projector LED Headlamp & Smart Scooter',
      category: 'SCOOTER',
      price: 118000,
      engine: '110 cc',
      power: '8.1 PS',
      mileage: '50 kmpl',
      braking: 'IBS Scooter',
      icon: 'fa-motorcycle',
      badge: 'Smart Scooter'
    }
  ];

  // =====================================================
  // INITIALIZATION & AUTH GUARD
  // =====================================================
  document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    setupEventListeners();
    renderBikeShowcase('ALL');
    initEmiCalculator();

    // Firebase Auth Listener
    auth.onAuthStateChanged(user => {
      const overlay = document.getElementById('authLoadingOverlay');
      if (overlay) overlay.style.display = 'none';

      if (user) {
        STATE.currentUser = user;
        showToast(`স্বাগতম, ${user.email} (ম্যানেজার পোর্টাল অ্যাক্টিভ)`, 'success');
      } else {
        STATE.currentUser = null;
      }
      loadPartsFromFirestore();
    });
  });

  // =====================================================
  // THEME MANAGEMENT
  // =====================================================
  function initTheme() {
    if (STATE.theme === 'light') {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
      updateThemeBtnIcon('fa-moon', 'Dark Mode');
    } else {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
      updateThemeBtnIcon('fa-sun', 'Light Mode');
    }
  }

  function toggleTheme() {
    STATE.theme = STATE.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('MOTO_THEME', STATE.theme);
    initTheme();
    if (chartTopPartsInstance) renderCharts();
  }

  function updateThemeBtnIcon(icon, title) {
    const btn = document.getElementById('themeToggleBtn');
    if (btn) {
      btn.innerHTML = `<i class="fa-solid ${icon}"></i>`;
      btn.setAttribute('title', title);
    }
  }

  // =====================================================
  // FIRESTORE SYNC & DATA LOADING
  // =====================================================
  function loadPartsFromFirestore() {
    STATE.unsubscribeParts = db.collection('parts')
      .orderBy('sl', 'asc')
      .onSnapshot(
        snapshot => {
          if (snapshot.empty) {
            seedDatabaseFromInitialData();
            return;
          }

          STATE.parts = [];
          snapshot.forEach(doc => {
            STATE.parts.push({ docId: doc.id, ...doc.data() });
          });

          renderCustomerParts();
          if (!document.getElementById('inventoryPortal').classList.contains('hidden')) {
            populateFilters();
            renderAllManagerData();
          }
        },
        error => {
          console.warn('Firestore error, falling back to local dataset:', error);
          if (window.INITIAL_PARTS_DATA) {
            STATE.parts = window.INITIAL_PARTS_DATA;
            renderCustomerParts();
          }
        }
      );
  }

  async function seedDatabaseFromInitialData() {
    const initialData = window.INITIAL_PARTS_DATA;
    if (!initialData || initialData.length === 0) return;

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
  }

  // =====================================================
  // EVENT LISTENERS
  // =====================================================
  function setupEventListeners() {
    // Theme Toggle
    document.getElementById('themeToggleBtn')?.addEventListener('click', toggleTheme);

    // Mobile Drawer Navigation
    const drawerBackdrop = document.getElementById('mobileDrawerBackdrop');
    const drawer = document.getElementById('mobileDrawer');
    
    document.getElementById('mobileMenuToggle')?.addEventListener('click', () => {
      drawerBackdrop?.classList.add('active');
      drawer?.classList.add('active');
    });

    const closeDrawer = () => {
      drawerBackdrop?.classList.remove('active');
      drawer?.classList.remove('active');
    };

    document.getElementById('mobileDrawerClose')?.addEventListener('click', closeDrawer);
    drawerBackdrop?.addEventListener('click', closeDrawer);

    // Drawer links navigation
    document.querySelectorAll('.drawer-link').forEach(link => {
      link.addEventListener('click', e => {
        closeDrawer();
        const target = link.getAttribute('data-drawer');
        if (target === 'hero' || target === 'bikes' || target === 'services' || target === 'parts' || target === 'emi' || target === 'contact') {
          showPublicWebsite();
        }
      });
    });

    // Navigation Links
    document.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', e => {
        const target = link.getAttribute('data-nav');
        if (target) showPublicWebsite();
      });
    });

    // Manager Portal Toggle
    document.getElementById('btnNavManagerPortal')?.addEventListener('click', toggleManagerPortal);
    document.getElementById('btnDrawerManagerPortal')?.addEventListener('click', toggleManagerPortal);
    document.getElementById('btnReturnToWebsite')?.addEventListener('click', showPublicWebsite);
    document.getElementById('brandLogoHome')?.addEventListener('click', showPublicWebsite);

    // Booking Modals Triggers
    document.getElementById('btnHeaderBookService')?.addEventListener('click', () => openBookingModal('SERVICE'));
    document.getElementById('btnHeroBookService')?.addEventListener('click', () => openBookingModal('SERVICE'));
    document.getElementById('btnDrawerBookService')?.addEventListener('click', () => openBookingModal('SERVICE'));
    document.getElementById('btnBannerBookService')?.addEventListener('click', () => openBookingModal('SERVICE'));

    // Bike Category Filter Tabs
    document.querySelectorAll('.bike-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.bike-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const cat = tab.getAttribute('data-category');
        renderBikeShowcase(cat);
      });
    });

    // Customer Parts Live Search
    const custSearch = document.getElementById('customerPartsSearchInput');
    custSearch?.addEventListener('input', e => {
      STATE.customerPartsSearch = e.target.value;
      renderCustomerParts();
    });
    document.getElementById('btnCustomerSearchParts')?.addEventListener('click', renderCustomerParts);

    // Booking Form Submit
    document.getElementById('formBooking')?.addEventListener('submit', handleBookingSubmit);

    // Contact Form Submit
    document.getElementById('formContactInquiry')?.addEventListener('submit', e => {
      e.preventDefault();
      const name = document.getElementById('contactName').value;
      showToast(`ধন্যবাদ ${name}! আপনার বার্তাটি প্রাপ্ত হয়েছে। আমাদের টিম আপনার সাথে দ্রুত যোগাযোগ করবে।`, 'success');
      e.target.reset();
    });

    // Manager Portal Sub-tabs
    document.querySelectorAll('.portal-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.portal-tab').forEach(t => {
          t.classList.remove('active', 'btn-primary');
          t.classList.add('btn-outline');
        });
        tab.classList.add('active', 'btn-primary');
        tab.classList.remove('btn-outline');
        
        const ptab = tab.getAttribute('data-ptab');
        document.querySelectorAll('.portal-tab-content').forEach(c => c.classList.add('hidden'));
        document.getElementById(`ptab-${ptab}`)?.classList.remove('hidden');

        if (ptab === 'dashboard') renderCharts();
      });
    });

    // Modal Close buttons
    document.querySelectorAll('[data-close]').forEach(btn => {
      btn.addEventListener('click', () => {
        const modalId = btn.getAttribute('data-close');
        closeModal(modalId);
      });
    });

    // Manager Login
    document.getElementById('formQuickLogin')?.addEventListener('submit', handleManagerLogin);
    document.getElementById('btnManagerLogout')?.addEventListener('click', async () => {
      await auth.signOut();
      showToast('ম্যানেজার অ্যাকাউন্ট লগআউট করা হয়েছে।', 'info');
      showPublicWebsite();
    });

    // Manager Actions
    document.getElementById('btnAddNewPart')?.addEventListener('click', () => openPartFormModal());
    document.getElementById('btnQuickReceive')?.addEventListener('click', () => openStockTxModal('RECEIVE'));
    document.getElementById('btnQuickIssue')?.addEventListener('click', () => openStockTxModal('ISSUE'));
    document.getElementById('formPart')?.addEventListener('submit', handlePartFormSubmit);
    document.getElementById('formTx')?.addEventListener('submit', handleTxSubmit);

    // Manager Inventory Filters
    document.getElementById('searchInput')?.addEventListener('input', e => {
      STATE.search = e.target.value;
      STATE.currentPage = 1;
      renderInventoryTable();
    });
    document.getElementById('filterStore')?.addEventListener('change', e => {
      STATE.filterStore = e.target.value;
      STATE.currentPage = 1;
      renderInventoryTable();
    });
    document.getElementById('filterType')?.addEventListener('change', e => {
      STATE.filterType = e.target.value;
      STATE.currentPage = 1;
      renderInventoryTable();
    });
    document.getElementById('filterStatus')?.addEventListener('change', e => {
      STATE.filterStatus = e.target.value;
      STATE.currentPage = 1;
      renderInventoryTable();
    });

    // Report Controls
    document.getElementById('btnGenerateReport')?.addEventListener('click', renderReport);
    document.getElementById('btnPrintReport')?.addEventListener('click', () => window.print());

    // Excel Upload
    const dropZone = document.getElementById('excelDropZone');
    const fileInput = document.getElementById('excelFileInput');

    document.getElementById('btnSelectExcelFile')?.addEventListener('click', () => fileInput.click());
    fileInput?.addEventListener('change', e => handleExcelFile(e.target.files[0]));

    dropZone?.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('active'); });
    dropZone?.addEventListener('dragleave', () => dropZone.classList.remove('active'));
    dropZone?.addEventListener('drop', e => {
      e.preventDefault();
      dropZone.classList.remove('active');
      if (e.dataTransfer.files.length) handleExcelFile(e.dataTransfer.files[0]);
    });
  }

  // =====================================================
  // PUBLIC WEBSITE VS MANAGER PORTAL TOGGLE
  // =====================================================
  function showPublicWebsite() {
    document.getElementById('mainPublicContent').classList.remove('hidden');
    document.getElementById('siteHeader').classList.remove('hidden');
    document.querySelector('.site-footer').classList.remove('hidden');
    document.getElementById('inventoryPortal').classList.add('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function toggleManagerPortal() {
    if (!STATE.currentUser) {
      openModal('modalLogin');
      return;
    }

    document.getElementById('mainPublicContent').classList.add('hidden');
    document.getElementById('siteHeader').classList.remove('hidden');
    document.querySelector('.site-footer').classList.add('hidden');
    document.getElementById('inventoryPortal').classList.remove('hidden');
    
    populateFilters();
    renderAllManagerData();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // =====================================================
  // RENDER BIKE SHOWCASE
  // =====================================================
  function renderBikeShowcase(category = 'ALL') {
    const container = document.getElementById('bikeGridContainer');
    if (!container) return;

    const filtered = category === 'ALL' 
      ? HERO_BIKES 
      : HERO_BIKES.filter(b => b.category === category);

    container.innerHTML = filtered.map(bike => `
      <div class="bike-card">
        <div class="bike-img-box">
          <i class="fa-solid ${bike.icon}"></i>
          <span class="bike-category-badge">${bike.badge}</span>
        </div>

        <div class="bike-details">
          <h3 class="bike-name">${bike.name}</h3>
          <p class="bike-subtitle">${bike.subtitle}</p>

          <div class="bike-price-box">
            <span class="bike-price">৳ ${bike.price.toLocaleString('bn-BD')}</span>
          </div>

          <div class="bike-spec-pills">
            <div class="spec-pill"><i class="fa-solid fa-gauge-high"></i> ${bike.engine}</div>
            <div class="spec-pill"><i class="fa-solid fa-bolt"></i> ${bike.power}</div>
            <div class="spec-pill"><i class="fa-solid fa-gas-pump"></i> ${bike.mileage}</div>
            <div class="spec-pill"><i class="fa-solid fa-shield"></i> ${bike.braking}</div>
          </div>

          <div class="bike-card-actions">
            <button class="btn btn-primary btn-book-testride" data-bike="${bike.name}">
              <i class="fa-solid fa-gauge-high"></i> টেস্ট রাইড
            </button>
            <button class="btn btn-outline btn-calc-emi" data-price="${bike.price}">
              <i class="fa-solid fa-calculator"></i> ইএমআই
            </button>
          </div>
        </div>
      </div>
    `).join('');

    // Attach event listeners to generated buttons
    container.querySelectorAll('.btn-book-testride').forEach(btn => {
      btn.addEventListener('click', () => {
        const bikeName = btn.getAttribute('data-bike');
        openBookingModal('TESTRIDE', bikeName);
      });
    });

    container.querySelectorAll('.btn-calc-emi').forEach(btn => {
      btn.addEventListener('click', () => {
        const price = parseInt(btn.getAttribute('data-price')) || 200000;
        document.getElementById('emiSliderPrice').value = price;
        updateEmiCalculation();
        document.getElementById('emi').scrollIntoView({ behavior: 'smooth' });
      });
    });
  }

  // =====================================================
  // RENDER CUSTOMER GENUINE PARTS
  // =====================================================
  function renderCustomerParts() {
    const tbody = document.getElementById('customerPartsTableBody');
    const countEl = document.getElementById('customerPartsSearchCount');
    if (!tbody) return;

    let list = STATE.parts || [];
    const query = (STATE.customerPartsSearch || '').toLowerCase().trim();

    if (query) {
      list = list.filter(p => 
        (p.partNo || '').toLowerCase().includes(query) ||
        (p.description || '').toLowerCase().includes(query) ||
        (p.store || '').toLowerCase().includes(query)
      );
    }

    // Limit to top 15 items for customer UI performance
    const displayList = list.slice(0, 15);

    if (countEl) {
      countEl.textContent = `${list.length}টি পার্টস পাওয়া গেছে`;
    }

    if (displayList.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align:center;padding:24px;color:var(--text-muted);">
            <i class="fa-solid fa-box-open" style="font-size:2rem;margin-bottom:8px;display:block;"></i>
            কোন পার্টস পাওয়া যায়নি। সঠিক Parts No বা বিবরণ দিয়ে পুনরায় খুঁজুন।
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = displayList.map(item => {
      const qty = parseInt(item.qty) || 0;
      let statusBadge = '<span class="badge-status badge-in-stock"><i class="fa-solid fa-check"></i> স্টকে আছে</span>';
      if (qty <= 0) {
        statusBadge = '<span class="badge-status badge-out-stock"><i class="fa-solid fa-xmark"></i> স্টক আউট</span>';
      } else if (qty <= 2) {
        statusBadge = '<span class="badge-status badge-low-stock"><i class="fa-solid fa-triangle-exclamation"></i> সীমিত স্টক</span>';
      }

      return `
        <tr>
          <td><strong class="text-primary">${item.partNo || '--'}</strong></td>
          <td>${item.description || '--'}</td>
          <td><span style="font-size:0.8rem;color:var(--text-sub);"><i class="fa-solid fa-store"></i> ${item.store || 'Moto Zone'}</span></td>
          <td>${statusBadge}</td>
          <td><strong>৳ ${(parseFloat(item.unitPrice) || 0).toLocaleString('bn-BD')}</strong></td>
          <td>
            <button class="btn btn-sm btn-outline btn-inquire-part" data-part="${item.partNo}">
              <i class="fa-solid fa-phone"></i> ইনকোয়ারি
            </button>
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('.btn-inquire-part').forEach(btn => {
      btn.addEventListener('click', () => {
        const pNo = btn.getAttribute('data-part');
        showToast(`পার্টস নং: ${pNo} সম্পর্কিত তথ্য জানতে সরাসরি হটলাইনে কল করুন: 01700-000000`, 'info');
      });
    });
  }

  // =====================================================
  // INTERACTIVE EMI CALCULATOR
  // =====================================================
  function initEmiCalculator() {
    const sliderPrice = document.getElementById('emiSliderPrice');
    const sliderDown = document.getElementById('emiSliderDown');
    const sliderTenure = document.getElementById('emiSliderTenure');
    const sliderInterest = document.getElementById('emiSliderInterest');

    if (!sliderPrice) return;

    const update = () => updateEmiCalculation();

    sliderPrice.addEventListener('input', update);
    sliderDown.addEventListener('input', update);
    sliderTenure.addEventListener('input', update);
    sliderInterest.addEventListener('input', update);

    document.getElementById('btnEmiApply')?.addEventListener('click', () => {
      openBookingModal('SERVICE');
      showToast('ইএমআই সহায়তার জন্য ফর্মটি পূরণ করে সাবমিট করুন।', 'info');
    });

    updateEmiCalculation();
  }

  function updateEmiCalculation() {
    const price = parseInt(document.getElementById('emiSliderPrice').value) || 200000;
    const downPct = parseInt(document.getElementById('emiSliderDown').value) || 30;
    const tenureMonths = parseInt(document.getElementById('emiSliderTenure').value) || 12;
    const annualInterestRate = parseFloat(document.getElementById('emiSliderInterest').value) || 10.5;

    const downPaymentAmount = Math.round(price * (downPct / 100));
    const loanAmount = price - downPaymentAmount;

    const monthlyInterestRate = (annualInterestRate / 12) / 100;
    
    let monthlyEmi = 0;
    if (monthlyInterestRate > 0) {
      monthlyEmi = Math.round(
        (loanAmount * monthlyInterestRate * Math.pow(1 + monthlyInterestRate, tenureMonths)) /
        (Math.pow(1 + monthlyInterestRate, tenureMonths) - 1)
      );
    } else {
      monthlyEmi = Math.round(loanAmount / tenureMonths);
    }

    const totalPayableLoan = monthlyEmi * tenureMonths;
    const totalInterest = Math.max(0, totalPayableLoan - loanAmount);
    const grandTotal = downPaymentAmount + totalPayableLoan;

    // Update Slider Value Texts
    document.getElementById('emiValPrice').textContent = `৳ ${price.toLocaleString('bn-BD')}`;
    document.getElementById('emiValDown').textContent = `${downPct}% (৳ ${downPaymentAmount.toLocaleString('bn-BD')})`;
    document.getElementById('emiValTenure').textContent = `${tenureMonths} মাস (${(tenureMonths/12).toFixed(1)} Year)`;
    document.getElementById('emiValInterest').textContent = `${annualInterestRate}%`;

    // Update Result Highlights
    document.getElementById('emiResultMonthly').textContent = `৳ ${monthlyEmi.toLocaleString('bn-BD')} / মাস`;
    document.getElementById('emiBreakdownDown').textContent = `৳ ${downPaymentAmount.toLocaleString('bn-BD')}`;
    document.getElementById('emiBreakdownLoan').textContent = `৳ ${loanAmount.toLocaleString('bn-BD')}`;
    document.getElementById('emiBreakdownInterest').textContent = `৳ ${totalInterest.toLocaleString('bn-BD')}`;
    document.getElementById('emiBreakdownTotal').textContent = `৳ ${grandTotal.toLocaleString('bn-BD')}`;
  }

  // =====================================================
  // MODAL HANDLERS
  // =====================================================
  function openModal(modalId) {
    document.getElementById(modalId)?.classList.add('active');
  }

  function closeModal(modalId) {
    document.getElementById(modalId)?.classList.remove('active');
  }

  function openBookingModal(type = 'SERVICE', bikeName = null) {
    const selectType = document.getElementById('bookingType');
    if (selectType) selectType.value = type;

    if (bikeName) {
      const selectBike = document.getElementById('bookingBikeModel');
      if (selectBike) selectBike.value = bikeName;
    }

    // Default tomorrow's date
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateInput = document.getElementById('bookingDate');
    if (dateInput) dateInput.value = tomorrow.toISOString().split('T')[0];

    openModal('modalBooking');
  }

  function handleBookingSubmit(e) {
    e.preventDefault();
    const type = document.getElementById('bookingType').value;
    const name = document.getElementById('bookingName').value;
    const phone = document.getElementById('bookingPhone').value;
    const bike = document.getElementById('bookingBikeModel').value;
    const date = document.getElementById('bookingDate').value;
    const time = document.getElementById('bookingTimeSlot').value;

    const refNo = 'MS-' + Math.floor(100000 + Math.random() * 900000);

    closeModal('modalBooking');
    e.target.reset();

    showToast(`✅ ${name}, আপনার ${type === 'SERVICE' ? 'সার্ভিস' : 'টেস্ট রাইড'} বুকিং সফল হয়েছে! রেফারেন্স নম্বর: ${refNo}`, 'success');
  }

  // =====================================================
  // MANAGER AUTH & PORTAL CRUD
  // =====================================================
  async function handleManagerLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const errorEl = document.getElementById('loginError');

    try {
      if (errorEl) errorEl.style.display = 'none';
      await auth.signInWithEmailAndPassword(email, password);
      closeModal('modalLogin');
      toggleManagerPortal();
    } catch (err) {
      if (errorEl) {
        errorEl.textContent = 'লগইন ব্যর্থ হয়েছে! সঠিক ইমেইল ও পাসওয়ার্ড লিখুন।';
        errorEl.style.display = 'block';
      }
    }
  }

  function renderAllManagerData() {
    renderKPIs();
    renderCharts();
    renderLowStockTable();
    renderInventoryTable();
  }

  function renderKPIs() {
    let totalValue = 0;
    let totalQty = 0;
    let lowStock = 0;

    STATE.parts.forEach(p => {
      const q = parseInt(p.qty) || 0;
      const price = parseFloat(p.unitPrice) || 0;
      totalValue += q * price;
      totalQty += q;
      if (q <= 2) lowStock++;
    });

    const kpiVal = document.getElementById('kpiTotalValue');
    const kpiQty = document.getElementById('kpiTotalQty');
    const kpiLow = document.getElementById('kpiLowStockCount');

    if (kpiVal) kpiVal.textContent = `৳ ${totalValue.toLocaleString('bn-BD', { minimumFractionDigits: 2 })}`;
    if (kpiQty) kpiQty.textContent = `${totalQty.toLocaleString('bn-BD')} পিস`;
    if (kpiLow) kpiLow.textContent = `${lowStock.toLocaleString('bn-BD')} আইটেম`;
  }

  function renderCharts() {
    const isDark = document.documentElement.classList.contains('dark');
    const textColor = isDark ? '#9ca3af' : '#475569';

    // Top Parts Bar Chart
    const topParts = [...STATE.parts]
      .sort((a, b) => (b.qty * b.unitPrice) - (a.qty * a.unitPrice))
      .slice(0, 10);

    const ctxBar = document.getElementById('chartTopParts')?.getContext('2d');
    if (ctxBar) {
      if (chartTopPartsInstance) chartTopPartsInstance.destroy();
      chartTopPartsInstance = new Chart(ctxBar, {
        type: 'bar',
        data: {
          labels: topParts.map(p => p.partNo || 'N/A'),
          datasets: [{
            label: 'স্টক মূল্য (৳)',
            data: topParts.map(p => (p.qty || 0) * (p.unitPrice || 0)),
            backgroundColor: 'rgba(225, 29, 72, 0.75)',
            borderColor: '#e11d48',
            borderRadius: 6
          }]
        },
        options: {
          responsive: true,
          plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { color: textColor } },
            y: { ticks: { color: textColor } }
          }
        }
      });
    }

    // Type Distribution Pie Chart
    const typeCounts = {};
    STATE.parts.forEach(p => {
      const t = p.type || 'H';
      typeCounts[t] = (typeCounts[t] || 0) + 1;
    });

    const ctxPie = document.getElementById('chartTypeDistribution')?.getContext('2d');
    if (ctxPie) {
      if (chartTypeInstance) chartTypeInstance.destroy();
      chartTypeInstance = new Chart(ctxPie, {
        type: 'doughnut',
        data: {
          labels: Object.keys(typeCounts),
          datasets: [{
            data: Object.values(typeCounts),
            backgroundColor: ['#e11d48', '#2563eb', '#10b981', '#f59e0b', '#8b5cf6']
          }]
        },
        options: {
          responsive: true,
          plugins: { legend: { labels: { color: textColor } } }
        }
      });
    }
  }

  function renderLowStockTable() {
    const tbody = document.getElementById('lowStockTableBody');
    if (!tbody) return;

    const lowStockParts = STATE.parts.filter(p => (parseInt(p.qty) || 0) <= 2);
    if (lowStockParts.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:16px;color:var(--text-muted);">সব পার্টসের পর্যাপ্ত স্টক রয়েছে।</td></tr>`;
      return;
    }

    tbody.innerHTML = lowStockParts.slice(0, 5).map(p => `
      <tr>
        <td><strong class="text-primary">${p.partNo}</strong></td>
        <td>${p.description}</td>
        <td>${p.store}</td>
        <td><span class="badge-status badge-low-stock">${p.qty} পিস</span></td>
        <td>৳ ${p.unitPrice}</td>
        <td>
          <button class="btn btn-sm btn-primary" onclick="window.quickRestock('${p.docId}')">
            <i class="fa-solid fa-plus"></i> স্টক ইন
          </button>
        </td>
      </tr>
    `).join('');
  }

  function renderInventoryTable() {
    const tbody = document.getElementById('inventoryTableBody');
    if (!tbody) return;

    let filtered = [...STATE.parts];

    if (STATE.search) {
      const q = STATE.search.toLowerCase();
      filtered = filtered.filter(p => 
        (p.partNo || '').toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q)
      );
    }

    if (STATE.filterStore !== 'ALL') filtered = filtered.filter(p => p.store === STATE.filterStore);
    if (STATE.filterType !== 'ALL') filtered = filtered.filter(p => p.type === STATE.filterType);
    if (STATE.filterStatus === 'IN_STOCK') filtered = filtered.filter(p => (parseInt(p.qty) || 0) > 2);
    if (STATE.filterStatus === 'LOW_STOCK') filtered = filtered.filter(p => (parseInt(p.qty) || 0) <= 2);

    document.getElementById('displayedCount').textContent = filtered.length;
    document.getElementById('totalCount').textContent = STATE.parts.length;

    const totalVal = filtered.reduce((acc, p) => acc + ((p.qty || 0) * (p.unitPrice || 0)), 0);
    document.getElementById('displayedValue').textContent = `৳ ${totalVal.toLocaleString('bn-BD', { minimumFractionDigits: 2 })}`;

    tbody.innerHTML = filtered.slice(0, 50).map((p, idx) => `
      <tr>
        <td>${idx + 1}</td>
        <td><strong class="text-primary">${p.partNo}</strong></td>
        <td>${p.description}</td>
        <td>${p.store}</td>
        <td><strong style="font-size:1.05rem;">${p.qty}</strong></td>
        <td>৳ ${p.unitPrice}</td>
        <td>৳ ${((p.qty || 0) * (p.unitPrice || 0)).toLocaleString('bn-BD')}</td>
        <td>
          ${p.qty > 2 
            ? '<span class="badge-status badge-in-stock">স্টকে আছে</span>'
            : '<span class="badge-status badge-low-stock">লো স্টক</span>'}
        </td>
        <td style="display:flex;gap:4px;align-items:center;">
          <button class="btn btn-sm btn-emerald" style="padding:3px 8px;font-size:0.78rem;" title="১টি পার্টস যুক্ত করুন" onclick="window.quickAdjustQty('${p.docId}', 1)">
            <i class="fa-solid fa-plus"></i>১
          </button>
          <button class="btn btn-sm btn-outline" style="padding:3px 8px;font-size:0.78rem;color:var(--amber);" title="১টি পার্টস কমান" onclick="window.quickAdjustQty('${p.docId}', -1)">
            <i class="fa-solid fa-minus"></i>১
          </button>
          <button class="btn btn-sm btn-outline" style="padding:3px 8px;" onclick="window.editPart('${p.docId}')" title="সম্পূর্ণ এডিট"><i class="fa-solid fa-edit"></i></button>
          <button class="btn btn-sm btn-outline text-rose" style="padding:3px 8px;" onclick="window.deletePart('${p.docId}')" title="ডিলিট"><i class="fa-solid fa-trash"></i></button>
        </td>
      </tr>
    `).join('');
  }

  function populateFilters() {
    const stores = new Set();
    const types = new Set();

    STATE.parts.forEach(p => {
      if (p.store) stores.add(p.store);
      if (p.type) types.add(p.type);
    });

    const selectStore = document.getElementById('filterStore');
    if (selectStore) {
      selectStore.innerHTML = '<option value="ALL">সকল স্টোর</option>' + 
        [...stores].map(s => `<option value="${s}">${s}</option>`).join('');
    }

    const selectType = document.getElementById('filterType');
    if (selectType) {
      selectType.innerHTML = '<option value="ALL">সকল টাইপ</option>' + 
        [...types].map(t => `<option value="${t}">${t}</option>`).join('');
    }
  }

  // Global Part CRUD Functions
  window.quickAdjustQty = async function(docId, delta) {
    const part = STATE.parts.find(p => p.docId === docId);
    if (!part) return;

    const currentQty = parseInt(part.qty) || 0;
    const newQty = Math.max(0, currentQty + delta);

    try {
      await db.collection('parts').doc(docId).update({ qty: newQty });
      showToast(`${part.partNo}: স্টক ${delta > 0 ? '+' + delta : delta} আপডেট হয়েছে (বর্তমান স্টক: ${newQty} পিস) ✅`, delta > 0 ? 'success' : 'info');
    } catch (e) {
      showToast('স্টক আপডেটে সমস্যা হয়েছে!', 'error');
    }
  };

  window.editPart = function(docId) {
    const part = STATE.parts.find(p => p.docId === docId);
    if (!part) return;

    document.getElementById('partId').value = docId;
    document.getElementById('inputPartNo').value = part.partNo || '';
    document.getElementById('inputDescription').value = part.description || '';
    document.getElementById('inputStore').value = part.store || '';
    document.getElementById('inputQty').value = part.qty || 1;
    document.getElementById('inputUnitPrice').value = part.unitPrice || 0;

    openModal('modalPartForm');
  };

  window.deletePart = async function(docId) {
    if (confirm('আপনি কি নিশ্চিতভাবে এই পার্টসটি ডিলিট করতে চান?')) {
      try {
        await db.collection('parts').doc(docId).delete();
        showToast('পার্টস ডিলিট করা হয়েছে!', 'info');
      } catch (e) {
        showToast('ডিলিট করতে সমস্যা হয়েছে!', 'error');
      }
    }
  };

  window.quickRestock = function(docId) {
    openStockTxModal('RECEIVE', docId);
  };

  function openPartFormModal() {
    document.getElementById('formPart').reset();
    document.getElementById('partId').value = '';
    openModal('modalPartForm');
  }

  async function handlePartFormSubmit(e) {
    e.preventDefault();
    const docId = document.getElementById('partId').value;
    const partData = {
      partNo: document.getElementById('inputPartNo').value,
      description: document.getElementById('inputDescription').value,
      store: document.getElementById('inputStore').value,
      qty: parseInt(document.getElementById('inputQty').value) || 0,
      unitPrice: parseFloat(document.getElementById('inputUnitPrice').value) || 0,
    };

    try {
      if (docId) {
        await db.collection('parts').doc(docId).update(partData);
        showToast('পার্টস তথ্য আপডেট হয়েছে! ✅', 'success');
      } else {
        await db.collection('parts').add({ ...partData, sl: Date.now() });
        showToast('নতুন পার্টস যুক্ত হয়েছে! ✅', 'success');
      }
      closeModal('modalPartForm');
    } catch (err) {
      showToast('সেভ করতে সমস্যা হয়েছে!', 'error');
    }
  }

  function openStockTxModal(type, preselectDocId = null) {
    const select = document.getElementById('txPartSelect');
    select.innerHTML = STATE.parts.map(p => `
      <option value="${p.docId}" ${p.docId === preselectDocId ? 'selected' : ''}>
        ${p.partNo} - ${p.description} (বর্তমান স্টক: ${p.qty})
      </option>
    `).join('');

    document.getElementById('txType').value = type;
    document.getElementById('modalTxTitle').textContent = type === 'RECEIVE' ? 'স্টক ইন (Receive Entry)' : 'স্টক আউট (Issue Entry)';
    openModal('modalStockTx');
  }

  async function handleTxSubmit(e) {
    e.preventDefault();
    const docId = document.getElementById('txPartSelect').value;
    const txType = document.getElementById('txType').value;
    const changeQty = parseInt(document.getElementById('txQty').value) || 0;

    const part = STATE.parts.find(p => p.docId === docId);
    if (!part) return;

    let newQty = parseInt(part.qty) || 0;
    if (txType === 'RECEIVE') newQty += changeQty;
    else newQty = Math.max(0, newQty - changeQty);

    try {
      await db.collection('parts').doc(docId).update({ qty: newQty });
      closeModal('modalStockTx');
      showToast('স্টক ট্রানজ্যাকশন সম্পন্ন হয়েছে! ✅', 'success');
    } catch (err) {
      showToast('ট্রানজ্যাকশন ব্যর্থ হয়েছে!', 'error');
    }
  }

  // =====================================================
  // EXCEL IMPORT HANDLER (APPEND VS REPLACE MODES)
  // =====================================================
  function handleExcelFile(file) {
    if (!file) return;
    document.getElementById('selectedFileName').textContent = file.name;
    
    const importMode = document.querySelector('input[name="importMode"]:checked')?.value || 'smart_sync';
    const syncQtyMethod = document.querySelector('input[name="syncQtyMethod"]:checked')?.value || 'add';

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet);

        if (json.length) {
          showToast(`${json.length}টি ফাইল রেকর্ড স্ক্যান করা হচ্ছে...`, 'info');

          // Build Lookup Map of Current Parts
          const existingMap = new Map();
          STATE.parts.forEach(p => {
            if (p.partNo) existingMap.set(p.partNo.toString().trim().toUpperCase(), p);
          });

          let newAddedCount = 0;
          let updatedCount = 0;

          // If Replace Mode: clear collection first
          if (importMode === 'replace') {
            const snap = await db.collection('parts').get();
            const deleteBatch = db.batch();
            snap.docs.forEach(doc => deleteBatch.delete(doc.ref));
            await deleteBatch.commit();
            existingMap.clear();
          }

          // Process batch writes
          const batchSize = 400;
          for (let i = 0; i < json.length; i += batchSize) {
            const batch = db.batch();
            const chunk = json.slice(i, i + batchSize);

            chunk.forEach(item => {
              // Flexible mapping for Parts Receive Detail.xls & WarehouseStockReport.xls
              const partNoRaw = (
                item['Material Code'] || 
                item['Parts No'] || 
                item['Part No'] || 
                item.partNo || 
                item['MaterialCode'] || 
                ''
              ).toString().trim();

              if (!partNoRaw || partNoRaw === 'Material Code' || partNoRaw === 'Parts No') return;

              const key = partNoRaw.toUpperCase();
              const itemQty = parseInt(
                item['Unrestricted Stock'] || 
                item['Qty'] || 
                item.qty || 
                item['Stock Qty'] || 
                0
              ) || 0;

              const unitPrice = parseFloat(
                item['Sales Price (BDT)'] || 
                item['Dealer Price (BDT)'] || 
                item['Unit Price'] || 
                item.unitPrice || 
                0
              ) || 0;

              const description = item['Description'] || item.description || '';
              const store = item['Store'] || item.store || 'Moto Zone Workshop';
              const rcvDate = item['RCV Date'] || item['Date'] || item.rcvDate || '';
              const invoiceNo = item['Invoice/JC No'] || item['Invoice No'] || item.invoiceNo || '';

              if (importMode === 'smart_sync' && existingMap.has(key)) {
                // UPDATE / SYNC EXISTING PART
                const existingDoc = existingMap.get(key);
                const docRef = db.collection('parts').doc(existingDoc.docId);
                
                // If syncQtyMethod is 'add' -> Accumulate (2 + 5 = 7)
                // If syncQtyMethod is 'set' -> Sync total to 5
                const finalQty = syncQtyMethod === 'add' 
                  ? (parseInt(existingDoc.qty) || 0) + itemQty 
                  : itemQty;

                batch.update(docRef, {
                  qty: finalQty,
                  unitPrice: unitPrice > 0 ? unitPrice : existingDoc.unitPrice,
                  description: description || existingDoc.description,
                  rcvDate: rcvDate || existingDoc.rcvDate,
                  invoiceNo: invoiceNo || existingDoc.invoiceNo,
                  updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                updatedCount++;
              } else {
                // NEW PART (Or Append / Replace mode)
                const docRef = db.collection('parts').doc();
                batch.set(docRef, {
                  partNo: partNoRaw,
                  description: description,
                  store: store,
                  qty: itemQty,
                  unitPrice: unitPrice,
                  rcvDate: rcvDate,
                  invoiceNo: invoiceNo,
                  sl: item.sl || Date.now()
                });
                newAddedCount++;
              }
            });

            await batch.commit();
          }

          let summaryText = `🎉 সিঙ্ক সম্পন্ন! `;
          if (newAddedCount > 0) summaryText += `🟢 ${newAddedCount}টি নতুন পার্টস যুক্ত হয়েছে। `;
          if (updatedCount > 0) summaryText += `🔄 ${updatedCount}টি পার্টসের স্টক আপডেট হয়েছে (${syncQtyMethod === 'add' ? 'যোগফল মোডে' : 'মোট স্টক মোডে'})।`;

          showToast(summaryText, 'success');
        }
      } catch (err) {
        console.error('Import error:', err);
        showToast('Excel ফাইল প্রক্রিয়াকরণে সমস্যা হয়েছে! ফাইল ফরম্যাট চেক করুন।', 'error');
      }
    };
    reader.readAsArrayBuffer(file);
  }

  // =====================================================
  // REPORT GENERATOR - Niloy Hero Official Invoice Layout
  // =====================================================

  function numberToWords(num) {
    const a = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine',
      'Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
    const b = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
    if (num === 0) return 'Zero';
    if (num < 0) return 'Minus ' + numberToWords(-num);
    let words = '';
    if (Math.floor(num / 1000) > 0) { words += numberToWords(Math.floor(num / 1000)) + ' Thousand '; num %= 1000; }
    if (Math.floor(num / 100) > 0) { words += a[Math.floor(num / 100)] + ' Hundred '; num %= 100; }
    if (num > 0) { words += num < 20 ? a[num] : b[Math.floor(num / 10)] + (num % 10 ? ' ' + a[num % 10] : ''); }
    return words.trim();
  }

  function renderReport() {
    const tbody = document.getElementById('reportTableBody');
    if (!tbody) return;

    const now = new Date();
    const fmtDate = now.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
    const printDateEl = document.getElementById('printCurrentDate');
    if (printDateEl) printDateEl.textContent = fmtDate;

    const mode = STATE.reportMode || 'daily';
    const titleEl = document.getElementById('printReportTitle');
    if (titleEl) titleEl.textContent = mode === 'daily' ? 'Daily Inventory Report' : 'Monthly Inventory Report';

    let totalPartsAmt = 0;
    tbody.innerHTML = STATE.parts.map((p, idx) => {
      const lineTotal = (p.qty || 0) * (p.unitPrice || 0);
      totalPartsAmt += lineTotal;
      return `<tr>
        <td style="text-align:center">${idx + 1}</td>
        <td><strong>${p.partNo || '-'}</strong></td>
        <td>${p.description || '-'}</td>
        <td>${p.rcvDate || '-'}</td>
        <td>Stock</td>
        <td style="text-align:right">${(p.unitPrice||0).toLocaleString()} Tk</td>
        <td style="text-align:center">${p.qty||0}</td>
        <td style="text-align:right"><strong>${lineTotal.toLocaleString()} Tk</strong></td>
      </tr>`;
    }).join('');

    const discount = Math.round(totalPartsAmt * 0.06);
    const finalPartsAmt = totalPartsAmt - discount;
    const lubricantsAmt = 655;
    const grandTotal = finalPartsAmt + lubricantsAmt;

    const g = id => document.getElementById(id);
    if (g('rptTotalPartsAmount')) g('rptTotalPartsAmount').textContent = totalPartsAmt.toLocaleString() + ' Tk';
    if (g('rptPartsDiscount'))    g('rptPartsDiscount').textContent    = discount.toLocaleString() + ' Tk';
    if (g('rptFinalPartsAmount')) g('rptFinalPartsAmount').textContent = finalPartsAmt.toLocaleString() + ' Tk';
    if (g('rptFinalBillAmount'))  g('rptFinalBillAmount').textContent  = grandTotal.toLocaleString() + ' Tk.';
    if (g('rptAmountInWords'))    g('rptAmountInWords').textContent    = 'Tk. ' + numberToWords(grandTotal) + ' Only.';

    showToast('Report ready! Use PDF Download or Print.', 'success');
  }

  function initReportButtons() {
    const btnPrint = document.getElementById('btnPrintReport');
    if (btnPrint) btnPrint.addEventListener('click', () => { renderReport(); setTimeout(() => window.print(), 350); });

    const btnPdf = document.getElementById('btnDownloadPdfReport');
    if (btnPdf) btnPdf.addEventListener('click', () => {
      renderReport();
      setTimeout(() => {
        const element = document.getElementById('printableReport');
        const today = new Date().toISOString().slice(0, 10);
        const opt = {
          margin: [8, 8, 8, 8],
          filename: 'MS_Moto_Zone_Report_' + today + '.pdf',
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, logging: false },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        if (typeof html2pdf !== 'undefined') {
          showToast('Preparing PDF...', 'info');
          html2pdf().set(opt).from(element).save().then(() => showToast('PDF Download complete!', 'success'));
        } else {
          window.print();
        }
      }, 400);
    });

    const btnGen = document.getElementById('btnGenerateReport');
    if (btnGen) btnGen.addEventListener('click', renderReport);

    const btnDaily = document.getElementById('btnModeDaily');
    const btnMonthly = document.getElementById('btnModeMonthly');
    if (btnDaily) btnDaily.addEventListener('click', () => {
      STATE.reportMode = 'daily';
      btnDaily.classList.add('active');
      if (btnMonthly) btnMonthly.classList.remove('active');
      renderReport();
    });
    if (btnMonthly) btnMonthly.addEventListener('click', () => {
      STATE.reportMode = 'monthly';
      btnMonthly.classList.add('active');
      if (btnDaily) btnDaily.classList.remove('active');
      renderReport();
    });

    const dateInput = document.getElementById('reportDailyDate');
    if (dateInput && !dateInput.value) dateInput.value = new Date().toISOString().slice(0, 10);
  }

  document.addEventListener('DOMContentLoaded', initReportButtons);

  // =====================================================
  // TOAST NOTIFICATIONS
  // =====================================================
  function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let icon = 'fa-circle-info';
    if (type === 'success') icon = 'fa-circle-check';
    if (type === 'error') icon = 'fa-circle-exclamation';

    toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

})();
