/**
 * KASIRKU - Modul Kasir & Transaksi Penjualan
 */

let allProducts = [];
let cart = [];
let activeCategory = 'all';
let barcodeScanner = null;
let selectedPaymentMethod = 'cash';
let currentDrawerCash = 0;
let cashierList = [];
let activeCashier = null;

document.addEventListener('DOMContentLoaded', () => {
  loadProducts();
  loadCategories();
  initBarcodeScanner();
  setupEventListeners();
  loadCashDrawerSummary();
  loadCashiers();
});

// ==========================================
// DAFTAR KASIR & DROPDOWN PEMILIHAN KASIR
// ==========================================
async function loadCashiers() {
  try {
    const res = await fetch('/api/auth/cashiers');
    const data = await res.json();
    if (data.success && Array.isArray(data.data)) {
      cashierList = data.data;

      // Tentukan kasir aktif:
      // 1. Dari localStorage jika ada
      // 2. Dari session login (/api/auth/me)
      const savedCashierId = localStorage.getItem('kasirku_active_cashier_id');
      let defaultCashier = cashierList.find(c => String(c.id) === String(savedCashierId));

      if (!defaultCashier) {
        try {
          const meRes = await fetch('/api/auth/me');
          const meData = await meRes.json();
          if (meData.success && meData.user) {
            defaultCashier = cashierList.find(c => c.id === meData.user.id);
          }
        } catch (_) {}
      }

      if (!defaultCashier && cashierList.length > 0) {
        defaultCashier = cashierList[0];
      }

      activeCashier = defaultCashier || null;
      if (activeCashier) {
        localStorage.setItem('kasirku_active_cashier_id', String(activeCashier.id));
      }

      populateCashierDropdowns();
    }
  } catch (err) {
    console.error('Gagal memuat daftar kasir:', err);
  }
}

function populateCashierDropdowns() {
  const dropdownIds = [
    'select-active-cashier',
    'mobile-select-active-cashier',
    'sidebar-select-cashier',
    'select-pay-cashier',
    'select-modal-awal-cashier',
    'cf-input-cashier'
  ];

  dropdownIds.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;

    el.innerHTML = cashierList.map(c => {
      const roleBadge = c.role === 'pemilik' ? '(Pemilik)' : '(Kasir)';
      const isSelected = activeCashier && String(activeCashier.id) === String(c.id) ? 'selected' : '';
      return `<option value="${c.id}" ${isSelected}>${c.name} ${roleBadge}</option>`;
    }).join('');

    if (activeCashier) {
      el.value = String(activeCashier.id);
    }
  });

  updateCashierUI();
}

function onActiveCashierChanged(cashierId) {
  const found = cashierList.find(c => String(c.id) === String(cashierId));
  if (found) {
    activeCashier = found;
    localStorage.setItem('kasirku_active_cashier_id', String(found.id));

    // Sinkronkan semua elemen dropdown agar seragam
    const dropdownIds = [
      'select-active-cashier',
      'mobile-select-active-cashier',
      'sidebar-select-cashier',
      'select-pay-cashier',
      'select-modal-awal-cashier',
      'cf-input-cashier'
    ];

    dropdownIds.forEach(id => {
      const el = document.getElementById(id);
      if (el && el.value !== String(found.id)) {
        el.value = String(found.id);
      }
    });

    updateCashierUI();
    showToast(`Kasir aktif: ${found.name}`, 'info');
  }
}

function updateCashierUI() {
  if (!activeCashier) return;
  const nameEl = document.getElementById('kasir-user-name');
  if (nameEl) nameEl.textContent = activeCashier.name;

  const roleBadge = document.getElementById('kasir-user-role-badge');
  if (roleBadge) {
    roleBadge.textContent = activeCashier.role === 'pemilik' ? 'Pemilik Toko' : 'Sesi Kasir Aktif';
  }
}

// Inisialisasi Scanner
function initBarcodeScanner() {
  barcodeScanner = new BarcodeScannerManager((scannedBarcode) => {
    handleBarcodeScanned(scannedBarcode);
  });
}

// Ambil data produk dari API
async function loadProducts() {
  try {
    const res = await fetch('/api/products?status=active');
    const data = await res.json();
    if (data.success) {
      allProducts = data.data;
      renderProductCards(allProducts);
    }
  } catch (err) {
    showToast('Gagal memuat katalog produk', 'error');
  }
}

// Ambil kategori untuk filter
async function loadCategories() {
  try {
    const res = await fetch('/api/products/categories');
    const data = await res.json();
    if (data.success) {
      const container = document.getElementById('category-filter-row');
      if (!container) return;
      container.innerHTML = `<button class="cat-pill active" data-id="all">Semua</button>`;
      data.data.forEach(cat => {
        container.innerHTML += `<button class="cat-pill" data-id="${cat.id}">${cat.name}</button>`;
      });

      // Event listener klik kategori
      container.querySelectorAll('.cat-pill').forEach(btn => {
        btn.addEventListener('click', () => {
          container.querySelectorAll('.cat-pill').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          activeCategory = btn.dataset.id;
          filterAndRender();
        });
      });
    }
  } catch (err) {
    console.error(err);
  }
}

// Filter dan render produk
function filterAndRender() {
  const query = document.getElementById('input-search-product')?.value.toLowerCase().trim() || '';
  const filtered = allProducts.filter(p => {
    const matchCat = activeCategory === 'all' || String(p.category_id) === String(activeCategory);
    const matchQuery = !query || 
      p.name.toLowerCase().includes(query) || 
      p.code.toLowerCase().includes(query) || 
      (p.barcode && p.barcode.toLowerCase().includes(query));
    return matchCat && matchQuery;
  });
  renderProductCards(filtered);
}

// Render grid produk
function renderProductCards(products) {
  const grid = document.getElementById('product-cards-grid');
  if (!grid) return;

  if (products.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 3rem 1rem; color: var(--color-text-muted);">
        <p style="font-size: 1.1rem; font-weight: 600;">Produk tidak ditemukan</p>
        <p style="font-size: 0.875rem;">Coba kata kunci lain atau pilih kategori Semua.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = products.map(p => {
    const isLow = p.stock <= p.min_stock;
    const isOut = p.stock <= 0;
    return `
      <div class="product-item-card" onclick="addToCartById(${p.id})">
        <div>
          <div class="card-prod-title">${p.name}</div>
          <div class="card-prod-meta">
            <span>${p.category_name || 'Umum'}</span>
            <span class="card-prod-stock ${isLow ? 'low' : ''}">
              ${isOut ? 'Habis' : `Sisa: ${formatDecimal(p.stock)} ${p.base_unit}`}
            </span>
          </div>
        </div>
        <div class="card-prod-bottom">
          <span class="card-prod-price mono">${formatRupiah(p.sell_price)}</span>
          <span class="card-add-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </span>
        </div>
      </div>
    `;
  }).join('');
}

// Tambah produk ke keranjang belanja (mendukung ID maupun objek data produk utuh)
function addToCart(productOrId) {
  let product = null;

  if (typeof productOrId === 'object' && productOrId !== null) {
    product = productOrId;
    // Sinkronkan ke allProducts jika belum ada di memory
    const existingInAll = allProducts.find(p => p.id === product.id);
    if (!existingInAll) {
      allProducts.push(product);
      filterAndRender();
    } else {
      Object.assign(existingInAll, product);
    }
  } else {
    product = allProducts.find(p => p.id === productOrId);
  }

  if (!product) {
    showToast('Data produk tidak ditemukan dalam katalog.', 'error');
    playBeep(false);
    return { success: false, message: 'Data produk tidak ditemukan.' };
  }

  if (product.stock <= 0) {
    showToast(`Stok '${product.name}' sudah habis (sisa 0 ${product.base_unit || ''})!`, 'error');
    playBeep(false);
    return { success: false, message: `Stok '${product.name}' habis.` };
  }

  const existingIndex = cart.findIndex(item => item.product_id === product.id);
  if (existingIndex > -1) {
    const currentQty = cart[existingIndex].quantity;
    const step = (product.base_unit === 'kg' || product.base_unit === 'liter') ? 0.5 : 1;
    const nextQty = currentQty + step;

    if (nextQty > product.stock) {
      showToast(`Stok tidak mencukupi untuk menambah '${product.name}'. Sisa stok: ${formatDecimal(product.stock)} ${product.base_unit}`, 'warning');
      playBeep(false);
      return { success: false, message: `Stok '${product.name}' tidak mencukupi.` };
    }

    cart[existingIndex].quantity = nextQty;
    cart[existingIndex].subtotal = nextQty * cart[existingIndex].unit_price;
  } else {
    // Satuan pecahan jika kg atau liter default 1 kg/liter
    const initialQty = 1;
    cart.push({
      product_id: product.id,
      name: product.name,
      base_unit: product.base_unit,
      unit: product.base_unit,
      unit_price: product.sell_price,
      quantity: initialQty,
      subtotal: initialQty * product.sell_price,
      max_stock: product.stock
    });
  }

  playBeep(true);
  renderCart();
  const addedItem = cart.find(item => item.product_id === product.id);
  return { success: true, item: addedItem, product };
}

function addToCartById(productId) {
  addToCart(productId);
}

// Update Tampilan HUD Scanner (Mode Alfamart)
function updateScannerHUD(addedItem = null, product = null) {
  const card = document.getElementById('scanner-last-scanned');
  const nameEl = document.getElementById('scanned-prod-name');
  const priceEl = document.getElementById('scanned-prod-price');
  const qtyEl = document.getElementById('scanned-prod-qty');
  const subtotalEl = document.getElementById('scanned-prod-subtotal');
  const liveCountEl = document.getElementById('scanner-live-items-count');
  const liveTotalEl = document.getElementById('scanner-live-total-amount');
  const statusText = document.getElementById('scanner-status-text');

  if (card && addedItem && product) {
    card.style.display = 'flex';
    if (nameEl) nameEl.textContent = product.name;
    if (priceEl) priceEl.textContent = formatRupiah(product.sell_price);
    if (qtyEl) qtyEl.textContent = `+1 (Total: ${formatDecimal(addedItem.quantity)} ${product.base_unit || 'pcs'})`;
    if (subtotalEl) subtotalEl.textContent = `Subtotal: ${formatRupiah(addedItem.subtotal)}`;
  }

  // Update total kuantitas barang & grand total di layar scanner
  const totalQty = cart.reduce((sum, item) => sum + item.quantity, 0);
  const grandTotal = cart.reduce((sum, item) => sum + item.subtotal, 0);

  if (liveCountEl) liveCountEl.textContent = `${formatDecimal(totalQty)} Barang`;
  if (liveTotalEl) liveTotalEl.textContent = formatRupiah(grandTotal);
  if (statusText && product) {
    statusText.textContent = `Berhasil scan: ${product.name} (+1)`;
  }
}

// Barcode scanner trigger handler (Pencarian Cepat 0-Latency & Continuous Multi-Scan)
async function handleBarcodeScanned(barcode) {
  if (!barcode || !String(barcode).trim()) return;
  const cleanBarcode = String(barcode).trim();

  // 1. Pencarian Cepat di Memory Lokal (Ultra-Fast < 1ms layaknya mesin POS Alfamart)
  let found = allProducts.find(p => 
    (p.barcode && String(p.barcode).trim() === cleanBarcode) ||
    (p.code && String(p.code).trim().toLowerCase() === cleanBarcode.toLowerCase())
  );

  if (found) {
    const res = addToCart(found);
    if (res && res.success) {
      updateScannerHUD(res.item, found);
      showToast(`Scan: ${found.name} (${formatRupiah(found.sell_price)})`, 'success');
    } else if (res && res.message) {
      const statusText = document.getElementById('scanner-status-text');
      if (statusText) statusText.textContent = res.message;
    }
    return;
  }

  // 2. Fallback pencarian ke Server API jika produk baru belum ada di cache memory
  try {
    const res = await fetch(`/api/products/barcode/${encodeURIComponent(cleanBarcode)}`);
    const data = await res.json();
    if (data.success && data.data) {
      const addRes = addToCart(data.data);
      if (addRes && addRes.success) {
        updateScannerHUD(addRes.item, data.data);
        showToast(`Scan: ${data.data.name} (${formatRupiah(data.data.sell_price)})`, 'success');
      }
    } else {
      playBeep(false);
      const statusText = document.getElementById('scanner-status-text');
      if (statusText) statusText.textContent = `Barcode '${cleanBarcode}' tidak terdaftar!`;
      showToast(data.message || `Barcode '${cleanBarcode}' tidak ditemukan!`, 'error');
    }
  } catch (err) {
    playBeep(false);
    const statusText = document.getElementById('scanner-status-text');
    if (statusText) statusText.textContent = `Gagal memindai: ${err.message}`;
    showToast(`Gagal membaca barcode: ${err.message}`, 'error');
  }
}

// Render keranjang belanja
function renderCart() {
  const container = document.getElementById('cart-items-list');
  const totalAmountEl = document.getElementById('cart-total-amount');
  const btnPay = document.getElementById('btn-open-payment');

  if (!container || !totalAmountEl) return;

  if (cart.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 3rem 1rem; color: var(--color-text-muted);">
        <p style="font-size: 1.05rem; font-weight: 600;">Keranjang Kosong</p>
        <p style="font-size: 0.8125rem;">Scan barcode atau klik produk untuk memulai transaksi.</p>
      </div>
    `;
    totalAmountEl.textContent = formatRupiah(0);
    if (btnPay) btnPay.disabled = true;
    return;
  }

  let grandTotal = 0;

  container.innerHTML = cart.map((item, idx) => {
    grandTotal += item.subtotal;
    const isFractional = (item.base_unit === 'kg' || item.base_unit === 'liter');
    return `
      <div class="cart-item-row">
        <div class="cart-item-header">
          <span class="cart-item-name">${item.name}</span>
          <span class="cart-item-subtotal mono">${formatRupiah(item.subtotal)}</span>
        </div>
        <div class="cart-item-controls">
          <span class="cart-item-price-unit mono">${formatRupiah(item.unit_price)} / ${item.unit}</span>
          <div class="qty-control-group">
            <button class="qty-btn" onclick="updateItemQty(${idx}, -${isFractional ? 0.25 : 1})">-</button>
            <input type="number" 
                   step="${isFractional ? '0.1' : '1'}" 
                   min="0.1" 
                   class="qty-input" 
                   value="${item.quantity}" 
                   onchange="setItemQtyDirect(${idx}, this.value)">
            <button class="qty-btn" onclick="updateItemQty(${idx}, ${isFractional ? 0.25 : 1})">+</button>
            <button class="btn-del-item" onclick="removeFromCart(${idx})" title="Hapus item">&times;</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  totalAmountEl.textContent = formatRupiah(grandTotal);
  if (btnPay) btnPay.disabled = false;
}

// Update kuantitas stepper
function updateItemQty(index, delta) {
  if (!cart[index]) return;
  const current = cart[index].quantity;
  const next = Math.round((current + delta) * 100) / 100;

  if (next <= 0) {
    removeFromCart(index);
    return;
  }

  if (next > cart[index].max_stock) {
    showToast(`Maksimal stok tersedia hanya ${formatDecimal(cart[index].max_stock)} ${cart[index].unit}`, 'warning');
    return;
  }

  cart[index].quantity = next;
  cart[index].subtotal = next * cart[index].unit_price;
  renderCart();
}

// Input kuantitas pecahan langsung (cth: 2.5 kg)
function setItemQtyDirect(index, value) {
  if (!cart[index]) return;
  const parsed = parseFloat(value);
  if (isNaN(parsed) || parsed <= 0) {
    removeFromCart(index);
    return;
  }

  if (parsed > cart[index].max_stock) {
    showToast(`Maksimal stok tersedia hanya ${formatDecimal(cart[index].max_stock)} ${cart[index].unit}`, 'warning');
    cart[index].quantity = cart[index].max_stock;
  } else {
    cart[index].quantity = parsed;
  }

  cart[index].subtotal = cart[index].quantity * cart[index].unit_price;
  renderCart();
}

// Hapus item dari keranjang
function removeFromCart(index) {
  cart.splice(index, 1);
  renderCart();
}

// Kosongkan keranjang
function clearCart() {
  if (cart.length === 0) return;
  if (confirm('Kosongkan semua pesanan di keranjang?')) {
    cart = [];
    renderCart();
  }
}

// Setup Event Listeners
function setupEventListeners() {
  // Input search manual
  const searchInput = document.getElementById('input-search-product');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      filterAndRender();
    });

    // Support enter di input search untuk barcode
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const val = searchInput.value.trim();
        if (val) {
          handleBarcodeScanned(val);
          searchInput.value = '';
          filterAndRender();
        }
      }
    });
  }

  // Tombol buka modal pembayaran
  const btnOpenPay = document.getElementById('btn-open-payment');
  if (btnOpenPay) {
    btnOpenPay.addEventListener('click', openPaymentModal);
  }

  // Tombol reset keranjang
  const btnClear = document.getElementById('btn-reset-cart');
  if (btnClear) {
    btnClear.addEventListener('click', clearCart);
  }

  // Tombol kamera scan barcode
  const btnScanCam = document.getElementById('btn-open-cam');
  if (btnScanCam) {
    btnScanCam.addEventListener('click', openCameraScannerModal);
  }
}

// ==========================================
// MODAL PEMBAYARAN, METODE, & KEMBALIAN
// ==========================================
function openPaymentModal() {
  if (cart.length === 0) return;

  const total = cart.reduce((sum, item) => sum + item.subtotal, 0);
  const modal = document.getElementById('modal-payment');
  const payTotalEl = document.getElementById('pay-total-amount');
  const qrisTotalEl = document.getElementById('qris-total-amount');
  const cashInput = document.getElementById('input-cash-amount');
  const drawerHint = document.getElementById('pay-modal-drawer-val');
  const payCashierSelect = document.getElementById('select-pay-cashier');

  if (payCashierSelect && activeCashier) {
    payCashierSelect.value = String(activeCashier.id);
  }

  if (payTotalEl) payTotalEl.textContent = formatRupiah(total);
  if (qrisTotalEl) qrisTotalEl.textContent = formatRupiah(total);
  if (drawerHint) drawerHint.textContent = formatRupiah(currentDrawerCash);

  // Default ke Tunai
  switchPaymentMethod('cash');

  if (cashInput) {
    cashInput.value = '';
    setTimeout(() => cashInput.focus(), 150);
  }

  // Sinkronkan nama konsumen
  const currentCust = (document.getElementById('input-customer-name')?.value || 'Umum').trim() || 'Umum';
  const payModalCust = document.getElementById('pay-modal-customer');
  if (payModalCust) payModalCust.value = currentCust;

  updateDynamicQuickCash(total);
  calculateChange(0, total);
  if (modal) modal.style.display = 'flex';
}

function closePaymentModal() {
  const modal = document.getElementById('modal-payment');
  if (modal) modal.style.display = 'none';
}

function switchPaymentMethod(method) {
  selectedPaymentMethod = method;
  const tabCash = document.getElementById('tab-pay-cash');
  const tabQris = document.getElementById('tab-pay-qris');
  const panelCash = document.getElementById('panel-pay-cash');
  const panelQris = document.getElementById('panel-pay-qris');
  const btnConfirm = document.getElementById('btn-confirm-checkout');
  const total = cart.reduce((sum, item) => sum + item.subtotal, 0);

  if (method === 'cash') {
    tabCash?.classList.add('active');
    tabQris?.classList.remove('active');
    if (panelCash) panelCash.style.display = 'block';
    if (panelQris) panelQris.style.display = 'none';

    const cashInput = document.getElementById('input-cash-amount');
    const cash = parseFloat(cashInput?.value) || 0;
    calculateChange(cash, total);
  } else {
    tabQris?.classList.add('active');
    tabCash?.classList.remove('active');
    if (panelCash) panelCash.style.display = 'none';
    if (panelQris) panelQris.style.display = 'block';
    if (btnConfirm) btnConfirm.disabled = false;
  }
}

// Rekomendasi Uang Pas & Pembulatan Cerdas
function updateDynamicQuickCash(total) {
  const container = document.getElementById('quick-cash-container');
  if (!container) return;

  const amounts = new Set();
  // Selalu ada opsi Uang Pas
  amounts.add('exact');

  if (total > 0) {
    // Pembulatan ke 5.000 terdekat ke atas
    const ceil5k = Math.ceil(total / 5000) * 5000;
    if (ceil5k > total) amounts.add(ceil5k);

    // Pembulatan ke 10.000 terdekat ke atas
    const ceil10k = Math.ceil(total / 10000) * 10000;
    if (ceil10k > total) amounts.add(ceil10k);

    // Lembaran umum rupiah
    const standardBills = [10000, 20000, 50000, 100000, 200000, 500000];
    for (const bill of standardBills) {
      if (bill > total) {
        amounts.add(bill);
        if (amounts.size >= 5) break;
      }
    }
  }

  container.innerHTML = '';
  amounts.forEach(amt => {
    const btn = document.createElement('button');
    btn.type = 'button';
    if (amt === 'exact') {
      btn.className = 'chip-cash';
      btn.textContent = 'Uang Pas';
      btn.onclick = () => setQuickCash('exact');
    } else {
      btn.className = 'chip-cash mono';
      btn.textContent = amt.toLocaleString('id-ID');
      btn.onclick = () => setQuickCash(amt);
    }
    container.appendChild(btn);
  });
}

function setQuickCash(val) {
  const total = cart.reduce((sum, item) => sum + item.subtotal, 0);
  const cashInput = document.getElementById('input-cash-amount');
  let amount = 0;

  if (val === 'exact') {
    amount = total;
  } else {
    amount = parseFloat(val);
  }

  if (cashInput) cashInput.value = amount;
  calculateChange(amount, total);
}

function addCashAmount(val) {
  const cashInput = document.getElementById('input-cash-amount');
  if (!cashInput) return;
  const current = parseFloat(cashInput.value) || 0;
  const nextVal = current + val;
  cashInput.value = nextVal;
  onCashInputChanged(nextVal);
}

function clearCashAmount() {
  const cashInput = document.getElementById('input-cash-amount');
  if (!cashInput) return;
  cashInput.value = '';
  onCashInputChanged(0);
}

function onCashInputChanged(val) {
  const total = cart.reduce((sum, item) => sum + item.subtotal, 0);
  const cash = parseFloat(val) || 0;
  calculateChange(cash, total);
}

// Rekomendasi Pecahan Lembaran Kembalian
function getChangeBreakdown(diff) {
  if (diff <= 0) return '';
  const denominations = [100000, 50000, 20000, 10000, 5000, 2000, 1000, 500];
  let remaining = diff;
  const parts = [];

  for (const denom of denominations) {
    if (remaining >= denom) {
      const count = Math.floor(remaining / denom);
      remaining = remaining % denom;
      parts.push(`${count}x Rp ${denom.toLocaleString('id-ID')}`);
    }
  }

  return parts.join(' • ');
}

function calculateChange(cash, total) {
  const changeBox = document.getElementById('change-box');
  const changeVal = document.getElementById('change-val-amount');
  const btnConfirm = document.getElementById('btn-confirm-checkout');
  const guideBox = document.getElementById('change-denominations-guide');
  const guideText = document.getElementById('change-denominations-text');
  const warningBox = document.getElementById('drawer-cash-warning');

  if (selectedPaymentMethod === 'qris') {
    if (btnConfirm) btnConfirm.disabled = false;
    return;
  }

  const diff = cash - total;

  if (cash < total) {
    if (changeBox) changeBox.className = 'change-box underpaid';
    if (changeVal) changeVal.textContent = diff === -total ? 'Rp 0' : `Kurang ${formatRupiah(Math.abs(diff))}`;
    if (btnConfirm) btnConfirm.disabled = true;
    if (guideBox) guideBox.style.display = 'none';
    if (warningBox) warningBox.style.display = 'none';
  } else {
    if (changeBox) changeBox.className = 'change-box';
    if (changeVal) changeVal.textContent = formatRupiah(diff);
    if (btnConfirm) btnConfirm.disabled = false;

    if (diff > 0) {
      const breakdown = getChangeBreakdown(diff);
      if (guideBox && guideText) {
        guideText.textContent = breakdown;
        guideBox.style.display = 'block';
      }
      if (warningBox) {
        warningBox.style.display = (currentDrawerCash > 0 && diff > currentDrawerCash) ? 'block' : 'none';
      }
    } else {
      if (guideBox) guideBox.style.display = 'none';
      if (warningBox) warningBox.style.display = 'none';
    }
  }
}

// Konfirmasi Transaksi Selesai
async function processCheckout() {
  const total = cart.reduce((sum, item) => sum + item.subtotal, 0);
  const cashInput = document.getElementById('input-cash-amount');
  let cashReceived = 0;

  if (selectedPaymentMethod === 'cash') {
    cashReceived = parseFloat(cashInput?.value) || 0;
    if (cashReceived < total) {
      showToast('Nominal uang yang diterima kurang!', 'error');
      return;
    }
  } else {
    // QRIS / Non-tunai otomatis pas
    cashReceived = total;
  }

  const btnConfirm = document.getElementById('btn-confirm-checkout');
  if (btnConfirm) {
    btnConfirm.disabled = true;
    btnConfirm.textContent = 'Memproses...';
  }

  try {
    const selectedCashierId = document.getElementById('select-pay-cashier')?.value || (activeCashier ? activeCashier.id : 1);
    const selectedCashierObj = cashierList.find(c => String(c.id) === String(selectedCashierId)) || activeCashier;
    const cashierName = selectedCashierObj ? selectedCashierObj.name : 'Kasir';
    const customerName = (document.getElementById('pay-modal-customer')?.value || document.getElementById('input-customer-name')?.value || 'Umum').trim() || 'Umum';

    const payload = {
      items: cart.map(item => ({
        product_id: item.product_id,
        quantity: item.quantity,
        unit: item.unit,
        unit_price: item.unit_price
      })),
      cash_received: cashReceived,
      payment_method: selectedPaymentMethod,
      cashier_id: selectedCashierId,
      cashier_name: cashierName,
      customer_name: customerName
    };

    const res = await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (data.success) {
      playBeep(true);
      closePaymentModal();
      showToast('Transaksi Berhasil!', 'success');

      // Tampilkan Struk
      showReceiptModal(data.data);

      // Refresh saldo laci kasir
      loadCashDrawerSummary();

      // Reset keranjang & nama konsumen
      cart = [];
      const custInput = document.getElementById('input-customer-name');
      const payCustInput = document.getElementById('pay-modal-customer');
      if (custInput) custInput.value = 'Umum';
      if (payCustInput) payCustInput.value = 'Umum';
      renderCart();
      loadProducts();
    } else {
      showToast(data.message || 'Transaksi gagal diproses.', 'error');
    }
  } catch (err) {
    showToast('Terjadi kesalahan koneksi saat memproses transaksi.', 'error');
  } finally {
    if (btnConfirm) {
      btnConfirm.disabled = false;
      btnConfirm.textContent = 'Konfirmasi & Selesai';
    }
  }
}

// ==========================================
// ARUS KAS & MODAL LACI KASIR (DRAWER FLOAT)
// ==========================================
async function loadCashDrawerSummary() {
  try {
    const res = await fetch('/api/cash/summary');
    const data = await res.json();
    if (data.success) {
      const summary = data.data;
      currentDrawerCash = summary.expected_drawer_cash || 0;

      // Update badge header (desktop & mobile)
      const headerDesktop = document.getElementById('kasir-header-drawer-cash');
      const headerMobile = document.getElementById('mobile-header-drawer-cash');
      const modalHint = document.getElementById('pay-modal-drawer-val');

      if (headerDesktop) headerDesktop.textContent = formatRupiah(currentDrawerCash);
      if (headerMobile) headerMobile.textContent = formatRupiah(currentDrawerCash);
      if (modalHint) modalHint.textContent = formatRupiah(currentDrawerCash);

      // Update ringkasan modal arus kas
      const elModalAwal = document.getElementById('cf-summary-modal-awal');
      const elSales = document.getElementById('cf-summary-sales');
      const elKasMasuk = document.getElementById('cf-summary-kas-masuk');
      const elKasKeluar = document.getElementById('cf-summary-kas-keluar');
      const elExpected = document.getElementById('cf-summary-expected-drawer');

      if (elModalAwal) elModalAwal.textContent = formatRupiah(summary.total_modal_awal || 0);
      if (elSales) elSales.textContent = formatRupiah(summary.total_cash_sales || 0);
      if (elKasMasuk) elKasMasuk.textContent = formatRupiah(summary.total_kas_masuk || 0);
      if (elKasKeluar) elKasKeluar.textContent = formatRupiah(summary.total_kas_keluar || 0);
      if (elExpected) elExpected.textContent = formatRupiah(currentDrawerCash);

      // Banner Peringatan Jika Modal Awal Hari Ini Belum Diisi
      const bannerAlert = document.getElementById('banner-modal-awal-alert');
      if (bannerAlert) {
        if (!summary.total_modal_awal || summary.total_modal_awal <= 0) {
          bannerAlert.style.display = 'flex';
        } else {
          bannerAlert.style.display = 'none';
        }
      }

      // Render riwayat arus kas
      renderCashFlowTable(summary.recent_flows || []);
    }
  } catch (err) {
    console.error('Gagal memuat ringkasan kas laci:', err);
  }
}

// ==========================================
// MODAL INPUT MODAL AWAL KASIR (BUKA SHIFT)
// ==========================================
function openModalAwalModal() {
  const modal = document.getElementById('modal-input-modal-awal');
  const inputAmount = document.getElementById('input-modal-awal-amount');
  const cashierSelect = document.getElementById('select-modal-awal-cashier');
  if (!modal) return;
  modal.style.display = 'flex';
  if (cashierSelect && activeCashier) {
    cashierSelect.value = String(activeCashier.id);
  }
  if (inputAmount) {
    inputAmount.value = '';
    setTimeout(() => inputAmount.focus(), 150);
  }
}

function closeModalAwalModal() {
  const modal = document.getElementById('modal-input-modal-awal');
  if (modal) modal.style.display = 'none';
}

function setQuickModalAwal(val) {
  const inputAmount = document.getElementById('input-modal-awal-amount');
  if (inputAmount) {
    inputAmount.value = val;
  }
}

async function submitModalAwal(e) {
  e.preventDefault();
  const inputAmount = document.getElementById('input-modal-awal-amount');
  const inputNotes = document.getElementById('input-modal-awal-notes');
  const cashierSelect = document.getElementById('select-modal-awal-cashier');
  const btnSave = document.getElementById('btn-save-modal-awal');

  const amount = parseFloat(inputAmount?.value);
  const notes = inputNotes?.value?.trim() || 'Modal awal kembalian pagi';
  const selectedCashierId = cashierSelect?.value || (activeCashier ? activeCashier.id : 1);

  if (isNaN(amount) || amount <= 0) {
    showToast('Masukkan nominal modal awal yang valid', 'error');
    return;
  }

  if (btnSave) {
    btnSave.disabled = true;
    btnSave.textContent = 'Menyimpan...';
  }

  try {
    const res = await fetch('/api/cash/flow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'modal_awal',
        amount: amount,
        notes: notes,
        user_id: selectedCashierId
      })
    });

    const data = await res.json();
    if (data.success) {
      playBeep(true);
      showToast(`Modal awal Rp ${amount.toLocaleString('id-ID')} berhasil dicatat!`, 'success');
      closeModalAwalModal();
      await loadCashDrawerSummary();
    } else {
      showToast(data.message || 'Gagal menyimpan modal awal.', 'error');
    }
  } catch (err) {
    showToast('Terjadi kesalahan koneksi.', 'error');
  } finally {
    if (btnSave) {
      btnSave.disabled = false;
      btnSave.textContent = 'Simpan Modal Awal';
    }
  }
}

function renderCashFlowTable(flows) {
  const tbody = document.getElementById('flow-history-table-body');
  if (!tbody) return;

  if (flows.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" style="text-align: center; color: var(--color-text-muted); padding: 1rem;">
          Belum ada catatan arus kas hari ini.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = flows.map(f => {
    let typeBadge = '<span class="badge" style="background: #DBEAFE; color: #1E40AF;">Modal Awal</span>';
    let sign = '+';
    let colorClass = 'color: #1E40AF;';

    if (f.type === 'kas_masuk') {
      typeBadge = '<span class="badge" style="background: #DCFCE7; color: #166534;">Kas Masuk</span>';
      sign = '+';
      colorClass = 'color: var(--color-success);';
    } else if (f.type === 'kas_keluar') {
      typeBadge = '<span class="badge" style="background: #FEE2E2; color: #991B1B;">Kas Keluar</span>';
      sign = '-';
      colorClass = 'color: var(--color-danger);';
    }

    const timeStr = f.created_at ? new Date(f.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-';

    return `
      <tr>
        <td class="mono" style="white-space: nowrap;">${timeStr}</td>
        <td>${typeBadge}</td>
        <td>${f.notes || '-'}</td>
        <td class="mono" style="text-align: right; font-weight: 700; ${colorClass}">
          ${sign} ${formatRupiah(f.amount)}
        </td>
      </tr>
    `;
  }).join('');
}

function openCashFlowModal() {
  const modal = document.getElementById('modal-cash-flow');
  const cashierSelect = document.getElementById('cf-input-cashier');
  if (!modal) return;
  loadCashDrawerSummary();
  if (cashierSelect && activeCashier) {
    cashierSelect.value = String(activeCashier.id);
  }
  modal.style.display = 'flex';
}

function closeCashFlowModal() {
  const modal = document.getElementById('modal-cash-flow');
  if (modal) modal.style.display = 'none';
}

async function submitCashFlow(e) {
  e.preventDefault();
  const typeEl = document.getElementById('cf-input-type');
  const amountEl = document.getElementById('cf-input-amount');
  const notesEl = document.getElementById('cf-input-notes');
  const cashierSelectEl = document.getElementById('cf-input-cashier');
  const btnSave = document.getElementById('btn-save-cash-flow');

  const type = typeEl?.value;
  const amount = parseFloat(amountEl?.value);
  const notes = notesEl?.value?.trim();
  const selectedCashierId = cashierSelectEl?.value || (activeCashier ? activeCashier.id : 1);

  if (!type || isNaN(amount) || amount <= 0) {
    showToast('Pilih jenis arus kas dan nominal yang valid', 'error');
    return;
  }

  if (btnSave) {
    btnSave.disabled = true;
    btnSave.textContent = 'Menyimpan...';
  }

  try {
    const res = await fetch('/api/cash/flow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type,
        amount,
        notes,
        user_id: selectedCashierId
      })
    });

    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'success');
      if (amountEl) amountEl.value = '';
      if (notesEl) notesEl.value = '';
      await loadCashDrawerSummary();
    } else {
      showToast(data.message || 'Gagal mencatat arus kas', 'error');
    }
  } catch (err) {
    showToast('Terjadi kesalahan koneksi', 'error');
  } finally {
    if (btnSave) {
      btnSave.disabled = false;
      btnSave.textContent = 'Simpan Catatan Kas';
    }
  }
}

// ==========================================
// MODAL STRUK CETAK THERMAL
// ==========================================
function showReceiptModal(txData) {
  const modal = document.getElementById('modal-receipt');
  if (!modal) return;

  const store = txData.store || {};
  document.getElementById('rcpt-store-name').textContent = store.store_name || 'Toko Kelontong Berkah';
  document.getElementById('rcpt-store-address').textContent = store.address || '';
  document.getElementById('rcpt-store-phone').textContent = store.phone ? `Telp: ${store.phone}` : '';
  document.getElementById('rcpt-invoice-no').textContent = txData.invoice_number;
  document.getElementById('rcpt-date').textContent = formatDateIndo(txData.date || txData.transaction_date || new Date().toISOString());
  const cashierDisplay = txData.cashier_name || (activeCashier ? activeCashier.name : 'Kasir');
  const rcptCashier = document.getElementById('rcpt-cashier');
  if (rcptCashier) rcptCashier.textContent = `Kasir: ${cashierDisplay}`;

  const customerDisplay = txData.customer_name || 'Umum';
  const rcptCustomer = document.getElementById('rcpt-customer');
  if (rcptCustomer) rcptCustomer.textContent = `Konsumen: ${customerDisplay}`;

  const isQris = txData.payment_method === 'qris';
  const payMethodEl = document.getElementById('rcpt-pay-method');
  const payLabelEl = document.getElementById('rcpt-pay-label');
  if (payMethodEl) payMethodEl.textContent = `Pembayaran: ${isQris ? 'QRIS' : 'Tunai'}`;
  if (payLabelEl) payLabelEl.textContent = isQris ? 'Non-Tunai (QRIS):' : 'Tunai:';

  const itemsList = document.getElementById('rcpt-items-container');
  itemsList.innerHTML = txData.items.map(item => `
    <div style="margin-bottom: 4px;">
      <div class="receipt-item-title">${item.name}</div>
      <div class="receipt-row">
        <span>${formatDecimal(item.quantity)} ${item.unit} x ${formatRupiah(item.price)}</span>
        <span>${formatRupiah(item.subtotal)}</span>
      </div>
    </div>
  `).join('');

  document.getElementById('rcpt-total').textContent = formatRupiah(txData.total_amount);
  document.getElementById('rcpt-cash').textContent = formatRupiah(txData.cash_received);
  document.getElementById('rcpt-change').textContent = formatRupiah(txData.change_amount);
  document.getElementById('rcpt-footer-note').textContent = store.receipt_footer || 'Terima kasih atas kunjungan Anda!';

  modal.style.display = 'flex';
}

function closeReceiptModal() {
  const modal = document.getElementById('modal-receipt');
  if (modal) modal.style.display = 'none';
}

function printReceipt() {
  window.print();
}

// ==========================================
// MODAL KAMERA BARCODE SCANNER (ALFAMART MODE)
// ==========================================
function openCameraScannerModal() {
  const modal = document.getElementById('modal-camera-scan');
  const statusText = document.getElementById('scanner-status-text');
  const soundIcon = document.getElementById('scanner-sound-icon');
  const soundBtn = document.getElementById('btn-toggle-sound');

  if (!modal) return;
  modal.style.display = 'flex';

  // Sinkronkan status tombol suara
  if (soundIcon && soundBtn) {
    const isSoundOn = window.scannerSoundEnabled !== false;
    soundIcon.innerHTML = isSoundOn 
      ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>'
      : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>';
    soundBtn.classList.toggle('active', isSoundOn);
  }

  // Sinkronkan live feed tray dengan keranjang saat ini
  updateScannerHUD();

  if (statusText) {
    statusText.textContent = 'Posisikan barcode produk di dalam area bidik...';
  }

  if (!barcodeScanner) {
    initBarcodeScanner();
  }

  barcodeScanner.startCameraScanner(
    'camera-reader-box',
    (scannedBarcode) => {
      // MODE KASIR ALFAMART: Barcode terbaca, audio beep berbunyi, keranjang terupdate,
      // KAMERA TIDAK MENUTUP (tetap standby untuk barang berikutnya)
      handleBarcodeScanned(scannedBarcode);
    },
    (errMsg) => {
      if (statusText) statusText.textContent = errMsg;
      showToast(errMsg, 'error');
    },
    { continuous: true }
  );
}

function closeCameraScannerModal() {
  const modal = document.getElementById('modal-camera-scan');
  if (barcodeScanner) {
    barcodeScanner.stopCameraScanner();
  }
  if (modal) modal.style.display = 'none';
}

function toggleScannerSound() {
  window.scannerSoundEnabled = !window.scannerSoundEnabled;
  localStorage.setItem('kasirku_sound_enabled', window.scannerSoundEnabled ? 'true' : 'false');

  const soundIcon = document.getElementById('scanner-sound-icon');
  const soundBtn = document.getElementById('btn-toggle-sound');
  if (soundIcon) {
    soundIcon.innerHTML = window.scannerSoundEnabled 
      ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>'
      : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>';
  }
  if (soundBtn) soundBtn.classList.toggle('active', window.scannerSoundEnabled);

  if (window.scannerSoundEnabled) {
    playBeep(true);
    showToast('Suara scanner aktif (Beep Kasir)', 'info');
  } else {
    showToast('Suara scanner dimatikan (Senyap)', 'info');
  }
}

async function toggleScannerTorch() {
  if (!barcodeScanner) return;
  const isTorchOn = await barcodeScanner.toggleTorch();
  const torchIcon = document.getElementById('scanner-torch-icon');
  const torchBtn = document.getElementById('btn-toggle-torch');

  if (torchBtn) torchBtn.classList.toggle('active', isTorchOn);
  if (torchIcon) {
    torchIcon.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>';
  }

  showToast(isTorchOn ? 'Senter kamera menyala' : 'Senter kamera mati / tidak didukung di perangkat ini', 'info');
}

async function switchScannerCamera() {
  if (!barcodeScanner) return;
  showToast('Beralih kamera...', 'info');
  const switched = await barcodeScanner.switchCamera(
    (scannedBarcode) => handleBarcodeScanned(scannedBarcode),
    (errMsg) => showToast(errMsg, 'error')
  );
  if (!switched) {
    showToast('Hanya satu kamera yang terdeteksi pada perangkat ini.', 'info');
  }
}

// ==========================================
// KONSUMEN / PELANGGAN HELPERS
// ==========================================
function syncCustomerInput(val) {
  const custInput = document.getElementById('input-customer-name');
  const payCustInput = document.getElementById('pay-modal-customer');
  if (custInput && custInput !== document.activeElement) custInput.value = val;
  if (payCustInput && payCustInput !== document.activeElement) payCustInput.value = val;
}

function setQuickCustomer(name) {
  const custInput = document.getElementById('input-customer-name');
  const payCustInput = document.getElementById('pay-modal-customer');
  if (custInput) custInput.value = name;
  if (payCustInput) payCustInput.value = name;
  showToast(`Konsumen diatur: ${name}`, 'info');
}

