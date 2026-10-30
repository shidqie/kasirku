/**
 * KASIRKU - Global Application Utilities
 */

// Format Rupiah: 15000 -> "Rp 15.000"
function formatRupiah(number) {
  const num = Math.round(parseFloat(number) || 0);
  const formatted = num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `Rp ${formatted}`;
}

// Format Desimal: 2.5 -> "2,5", 1.0 -> "1"
function formatDecimal(number) {
  const num = parseFloat(number) || 0;
  return new Intl.NumberFormat('id-ID', {
    maximumFractionDigits: 2
  }).format(num);
}

// Format Tanggal Indonesia
function formatDateIndo(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Toast Notifikasi
function showToast(message, type = 'info') {
  let container = document.getElementById('toast-root');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-root';
    container.style.position = 'fixed';
    container.style.bottom = '20px';
    container.style.right = '20px';
    container.style.zIndex = '9999';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '8px';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = 'toast-notice';

  let icon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
  if (type === 'success') {
    toast.style.backgroundColor = '#16A34A';
    icon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="flex-shrink:0;"><polyline points="20 6 9 17 4 12"/></svg>';
  } else if (type === 'error' || type === 'danger') {
    toast.style.backgroundColor = '#DC2626';
    icon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0;"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
  } else if (type === 'warning') {
    toast.style.backgroundColor = '#D97706';
    icon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
  }

  toast.innerHTML = `<span style="display:inline-flex; align-items:center;">${icon}</span> <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.2s ease';
    setTimeout(() => toast.remove(), 200);
  }, 3200);
}

// Audio Feedback Beep (Authentic Alfamart / Retail POS Scanner Tone)
window.scannerSoundEnabled = localStorage.getItem('kasirku_sound_enabled') !== 'false';

function playBeep(success = true) {
  if (window.scannerSoundEnabled === false) return;
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    if (success) {
      // Alfamart Crisp POS Beep: 1950 Hz, sharp, clear, high-frequency checkout beep
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1950, ctx.currentTime);
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.075);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.075);

      if ('vibrate' in navigator) {
        navigator.vibrate(45);
      }
    } else {
      // Error Buzz: Dua nada rendah cepat (320Hz & 280Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(320, ctx.currentTime);
      gain1.gain.setValueAtTime(0.15, ctx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start();
      osc1.stop(ctx.currentTime + 0.12);

      setTimeout(() => {
        try {
          const ctx2 = new AudioContext();
          const osc2 = ctx2.createOscillator();
          const gain2 = ctx2.createGain();
          osc2.type = 'sawtooth';
          osc2.frequency.setValueAtTime(280, ctx2.currentTime);
          gain2.gain.setValueAtTime(0.15, ctx2.currentTime);
          gain2.gain.exponentialRampToValueAtTime(0.0001, ctx2.currentTime + 0.12);
          osc2.connect(gain2);
          gain2.connect(ctx2.destination);
          osc2.start();
          osc2.stop(ctx2.currentTime + 0.12);
        } catch (_) {}
      }, 90);

      if ('vibrate' in navigator) {
        navigator.vibrate([60, 50, 60]);
      }
    }
  } catch (e) {
    // Abaikan jika browser membatasi autoplay audio sebelum interaksi
  }
}

// Global User Session & Role Handler
let currentUser = null;

async function syncUserSession() {
  try {
    const res = await fetch('/api/auth/me');
    const data = await res.json();
    if (data.success && data.user) {
      currentUser = data.user;
      const nameEl = document.getElementById('sidebar-user-name');
      const roleEl = document.getElementById('sidebar-user-role') || document.querySelector('.user-role');
      if (nameEl) nameEl.textContent = currentUser.name;
      if (roleEl) {
        if (currentUser.role === 'pemilik') {
          roleEl.innerHTML = '<span class="badge badge-warning" style="display: inline-flex; align-items: center; gap: 4px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg><span>Pemilik Toko</span></span>';
        } else {
          roleEl.innerHTML = '<span class="badge badge-primary" style="display: inline-flex; align-items: center; gap: 4px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg><span>Kasir Toko</span></span>';
        }
      }

      // Role-specific element visibility
      document.querySelectorAll('.owner-only').forEach((el) => {
        el.style.display = currentUser.role === 'pemilik' ? '' : 'none';
      });
      document.querySelectorAll('.cashier-hide').forEach((el) => {
        el.style.display = currentUser.role === 'pemilik' ? '' : 'none';
      });
    }
  } catch (e) {}
}

document.addEventListener('DOMContentLoaded', () => {
  syncUserSession();
});

// Global Logout Handler
async function handleLogout() {
  if (!confirm('Apakah Anda yakin ingin keluar dari KasirKu?')) return;
  try {
    const res = await fetch('/api/auth/logout', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      window.location.href = '/login';
    }
  } catch (err) {
    window.location.href = '/login';
  }
}

// Inisialisasi Service Worker PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js').catch(err => {
      console.log('SW registration note:', err);
    });
  });
}
