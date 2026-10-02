// Semua pengaturan ada di sini.
window.LOKERSUS_CONFIG = {
  // Kosong = MODE DEMO (aturan kata kunci sederhana, BUKAN model AI).
  // Backend jalan lokal terpisah  -> "http://127.0.0.1:8000/predict"
  // Frontend disajikan oleh backend -> "/predict"
  API_URL: "",

  MAX_CHARS: 5000,

  // warn = threshold final model (FINAL_THRESHOLD di notebook), di atasnya dianggap FAKE.
  // sus  = batas "High Risk" di notebook (0.6).
  THRESHOLDS: { warn: 0.2698, sus: 0.6 }
};
