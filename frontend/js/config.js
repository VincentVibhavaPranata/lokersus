// Semua pengaturan ada di sini.
window.LOKERSUS_CONFIG = {
  // Alamat backend (Render) + /predict
  API_URL: "https://lokersus.onrender.com/predict",

  MAX_CHARS: 5000,

  // warn = threshold final model, sus = batas "High Risk"
  THRESHOLDS: { warn: 0.2698, sus: 0.6 }
};