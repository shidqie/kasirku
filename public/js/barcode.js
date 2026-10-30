/**
 * KASIRKU - Barcode Scanner Integration (Alfamart High-Speed Scanner Engine)
 * Mendukung:
 * 1. Mode Kasir Alfamart (Continuous Multi-Scan tanpa menutup kamera)
 * 2. Hardware Barcode Scanner Gun USB / Bluetooth (Keyboard HID Emulation)
 * 3. Kamera HP (Kamera Belakang / Depan, Autofokus, & Senter Torch)
 * 4. Kamera Laptop / MacBook Webcam via BarcodeDetector Native & Html5Qrcode Fallback
 */

class BarcodeScannerManager {
  constructor(onBarcodeScanned) {
    this.onBarcodeScanned = onBarcodeScanned;
    this.buffer = '';
    this.lastKeyTime = Date.now();
    this.html5QrCode = null;
    this.videoStream = null;
    this.cameraInterval = null;

    // State Kontrol Alfamart Mode
    this.isScanning = false;
    this.isTorchOn = false;
    this.cameraList = [];
    this.currentCameraIndex = 0;
    this.lastScannedBarcode = '';
    this.lastScanTimestamp = 0;
    this.cooldownMs = 1200; // Cooldown 1.2 detik untuk barcode yang persis sama

    this.initHardwareScannerListener();
  }

  // Listener untuk Barcode Scanner Fisik (USB Gun / Bluetooth)
  initHardwareScannerListener() {
    window.addEventListener('keydown', (e) => {
      const activeEl = document.activeElement;
      // Jangan ganggu tombol navigasi atau shortcut browser
      if (e.key === 'Tab' || e.key === 'Escape' || e.ctrlKey || e.metaKey || e.altKey) {
        return;
      }

      const currentTime = Date.now();
      const timeDiff = currentTime - this.lastKeyTime;
      this.lastKeyTime = currentTime;

      // Scanner fisik USB mengetik dengan kecepatan sangat tinggi (< 60ms antar karakter)
      if (e.key === 'Enter') {
        if (this.buffer.length >= 3) {
          const barcode = this.buffer.trim();
          this.buffer = '';
          e.preventDefault();

          if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
            activeEl.value = '';
          }

          if (this.onBarcodeScanned) {
            this.flashReticle();
            this.onBarcodeScanned(barcode);
          }
        }
      } else if (e.key.length === 1) {
        // Jika jeda terlalu lama dan sedang mengetik manual di search box, reset buffer
        const isStandardInput = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA');
        if (timeDiff > 90 && isStandardInput) {
          this.buffer = '';
        }
        this.buffer += e.key;
      }
    });
  }

  // Efek Visual Kilat Hijau saat Barcode Berhasil Terbaca (Gaya Scanner Alfamart)
  flashReticle() {
    const flashEl = document.getElementById('scanner-hit-flash');
    const reticleEl = document.getElementById('scan-laser-reticle');
    const wrapEl = document.getElementById('scanner-viewport-wrap');

    if (flashEl) {
      flashEl.classList.add('active');
      setTimeout(() => flashEl.classList.remove('active'), 140);
    }

    if (reticleEl) {
      reticleEl.classList.add('hit-success');
      setTimeout(() => reticleEl.classList.remove('hit-success'), 200);
    }

    if (wrapEl) {
      wrapEl.classList.add('border-hit');
      setTimeout(() => wrapEl.classList.remove('border-hit'), 200);
    }
  }

  // Ambil daftar kamera yang tersedia di perangkat
  async enumerateCameras() {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        return [];
      }
      const devices = await navigator.mediaDevices.enumerateDevices();
      this.cameraList = devices.filter(d => d.kind === 'videoinput');
      return this.cameraList;
    } catch (_) {
      return [];
    }
  }

  // Mulai Kamera Pemindai (Continuous / Alfamart Multi-Scan Mode)
  async startCameraScanner(targetContainerOrId, onResult, onError, options = {}) {
    const isContinuous = options.continuous !== false; // Default true (Mode Alfamart)
    const videoEl = document.getElementById('camera-preview-video');
    const containerEl = document.getElementById('camera-reader-box');
    const reticleEl = document.getElementById('scan-laser-reticle');
    const statusEl = document.getElementById('camera-scan-status') || document.getElementById('scanner-status-text');

    if (statusEl) {
      statusEl.textContent = 'Membuka stream kamera...';
    }

    // Hentikan sesi scanner sebelumnya jika ada
    await this.stopCameraScanner();
    this.isScanning = true;
    this.isTorchOn = false;

    // Deteksi daftar kamera
    await this.enumerateCameras();

    // 1. Ambil MediaStream dari Kamera
    let stream = null;
    let selectedDeviceId = options.deviceId || null;

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Peramban tidak mendukung navigator.mediaDevices.getUserMedia');
      }

      const videoConstraints = {
        width: { ideal: 1280 },
        height: { ideal: 720 }
      };

      if (selectedDeviceId) {
        videoConstraints.deviceId = { exact: selectedDeviceId };
      } else {
        videoConstraints.facingMode = { ideal: 'environment' };
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: videoConstraints,
          audio: false
        });
      } catch (errFacing) {
        // Fallback untuk webcam MacBook / Laptop tanpa opsi environment
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false
        });
      }
    } catch (err) {
      console.error('Camera stream access failed:', err);
      let userMsg = 'Gagal mengakses kamera: ' + (err.message || err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        userMsg = 'Izin kamera ditolak. Izinkan akses kamera melalui ikon gembok di URL browser.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        userMsg = 'Kamera tidak terdeteksi pada perangkat.';
      }
      if (statusEl) statusEl.textContent = userMsg;
      if (onError) onError(userMsg);
      this.isScanning = false;
      return;
    }

    this.videoStream = stream;

    // 2. Tampilkan Live Stream ke Elemen Video
    if (videoEl) {
      videoEl.style.display = 'block';
      if (containerEl) containerEl.style.display = 'none';
      if (reticleEl) reticleEl.style.display = 'block';

      videoEl.srcObject = stream;
      try {
        await videoEl.play();
      } catch (playErr) {
        console.warn('Video play warning:', playErr);
      }

      if (statusEl) {
        statusEl.textContent = 'Kamera aktif. Arahkan barcode ke garis pemindai...';
      }
    }

    // 3. Callback Handler Pemindaian Barcode (Alfamart Smart Debounce)
    const handleDetectedBarcode = async (rawCode) => {
      if (!rawCode || !this.isScanning) return;
      const cleanCode = String(rawCode).trim();
      const now = Date.now();

      // Debounce anti-spam jika barcode yang sama dihadapkan terus ke kamera
      if (cleanCode === this.lastScannedBarcode && (now - this.lastScanTimestamp) < this.cooldownMs) {
        return;
      }

      this.lastScannedBarcode = cleanCode;
      this.lastScanTimestamp = now;

      // Beri efek visual kilat hijau layaknya mesin kasir minimarket
      this.flashReticle();

      if (onResult) {
        onResult(cleanCode);
      }

      // Jika bukan continuous (mode satuan), hentikan kamera
      if (!isContinuous) {
        await this.stopCameraScanner();
      }
    };

    // 4. Deteksi Real-Time
    // Prioritas 1: BarcodeDetector Native (Kecepatan tinggi bawaan Chrome/Edge/Android)
    if ('BarcodeDetector' in window) {
      try {
        const barcodeDetector = new window.BarcodeDetector({
          formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e', 'qr_code', 'itf']
        });

        this.cameraInterval = setInterval(async () => {
          if (!this.isScanning) return;
          try {
            if (videoEl && videoEl.readyState >= 2 && !videoEl.paused) {
              const barcodes = await barcodeDetector.detect(videoEl);
              if (barcodes && barcodes.length > 0) {
                const val = barcodes[0].rawValue;
                if (val) {
                  await handleDetectedBarcode(val);
                }
              }
            }
          } catch (_) {}
        }, 90); // Scan interval ultra-responsif 90ms
        return;
      } catch (detErr) {
        console.warn('BarcodeDetector native gagal diinisialisasi, beralih ke Html5Qrcode:', detErr);
      }
    }

    // Prioritas 2: Fallback Html5Qrcode (Safari iOS / Browser tanpa BarcodeDetector)
    const Html5QrcodeClass = window.Html5Qrcode || (typeof Html5Qrcode !== 'undefined' ? Html5Qrcode : null);
    if (Html5QrcodeClass && containerEl) {
      try {
        if (videoEl) {
          videoEl.style.display = 'none';
          if (this.videoStream) {
            this.videoStream.getTracks().forEach(t => t.stop());
            this.videoStream = null;
          }
        }
        containerEl.style.display = 'block';
        if (reticleEl) reticleEl.style.display = 'none';

        this.html5QrCode = new Html5QrcodeClass(containerEl.id || 'camera-reader-box');
        await this.html5QrCode.start(
          { facingMode: 'environment' },
          { fps: 20, qrbox: { width: 280, height: 160 }, aspectRatio: 1.333333 },
          async (decodedText) => {
            await handleDetectedBarcode(decodedText);
          },
          () => {}
        );
        if (statusEl) {
          statusEl.textContent = 'Kamera aktif. Posisikan barcode di dalam kotak...';
        }
        return;
      } catch (h5Err) {
        console.warn('Html5Qrcode fallback error:', h5Err);
      }
    }
  }

  // Nyalakan / Matikan Senter Flashlight (Torch) pada Kamera Ponsel
  async toggleTorch() {
    if (!this.videoStream) return false;
    const track = this.videoStream.getVideoTracks()[0];
    if (!track) return false;

    try {
      const capabilities = track.getCapabilities ? track.getCapabilities() : {};
      if (!capabilities.torch) {
        return false;
      }
      this.isTorchOn = !this.isTorchOn;
      await track.applyConstraints({
        advanced: [{ torch: this.isTorchOn }]
      });
      return this.isTorchOn;
    } catch (e) {
      console.warn('Tidak dapat mengubah status senter torch:', e);
      return false;
    }
  }

  // Beralih Antara Kamera Belakang, Depan, atau Kamera Eksternal
  async switchCamera(onResult, onError) {
    if (this.cameraList.length <= 1) {
      await this.enumerateCameras();
    }
    if (this.cameraList.length <= 1) {
      return false; // Hanya ada 1 kamera
    }

    this.currentCameraIndex = (this.currentCameraIndex + 1) % this.cameraList.length;
    const targetCamera = this.cameraList[this.currentCameraIndex];

    await this.startCameraScanner(
      'camera-reader-box',
      onResult,
      onError,
      { continuous: true, deviceId: targetCamera.deviceId }
    );
    return true;
  }

  // Hentikan Stream Kamera & Timer Pemindaian
  async stopCameraScanner(optionalVideo) {
    this.isScanning = false;

    if (this.cameraInterval) {
      clearInterval(this.cameraInterval);
      this.cameraInterval = null;
    }

    if (this.videoStream) {
      try {
        this.videoStream.getTracks().forEach((track) => track.stop());
      } catch (_) {}
      this.videoStream = null;
    }

    const video = optionalVideo || document.getElementById('camera-preview-video');
    if (video) {
      video.srcObject = null;
    }

    if (this.html5QrCode) {
      try {
        if (this.html5QrCode.isScanning) {
          await this.html5QrCode.stop();
        }
        this.html5QrCode.clear();
      } catch (_) {}
      this.html5QrCode = null;
    }
  }
}

window.BarcodeScannerManager = BarcodeScannerManager;
