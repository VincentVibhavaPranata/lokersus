// Komunikasi dengan backend. Kalau format respons berubah, cukup edit normalize().
(function () {
  const cfg = window.LOKERSUS_CONFIG;

  function normalize(d) {
    let score = d.probability ?? d.score ?? d.fake_probability;
    if (typeof score !== "number") throw new Error("Format respons backend tidak dikenali.");
    if (score > 1) score /= 100;
    return {
      score: Math.min(Math.max(score, 0), 1),
      label: typeof d.label === "string" ? d.label.toUpperCase() : null,
      threshold: typeof d.threshold === "number" ? d.threshold : cfg.THRESHOLDS.warn,
      assumed: d.assumed_defaults || [],
      reasons: d.reasons || [],
      demo: false
    };
  }

  // Mode demo: hanya untuk ngetes tampilan. Bukan hasil model.
  const RULES = [
    [/(registration|application|training) fee|deposit|wire (money|transfer)|biaya (pendaftaran|administrasi)/i, "Minta bayaran di awal"],
    [/no (experience|interview)|tanpa (pengalaman|interview)/i, "Janji tanpa pengalaman atau seleksi"],
    [/\$\s?\d{3,}\s*(-|to)\s*\$?\s?\d{4,}|gaji.{0,12}\d{2}\s*juta/i, "Gaji tinggi yang tidak masuk akal"],
    [/(contact|message|text).{0,25}(whatsapp|telegram)|hubungi.{0,25}(whatsapp|wa|telegram)/i, "Kontak hanya lewat WhatsApp atau Telegram"],
    [/(apply now|limited (spots|slots)|urgent|segera|slot terbatas)/i, "Menekan kamu untuk buru-buru"],
    [/(work from home|remote).{0,40}(easy|simple|mudah)/i, "Kerja online yang terlalu mudah"]
  ];

  function demo(text) {
    const reasons = RULES.filter(([re]) => re.test(text)).map(([, r]) => r);
    const score = Math.min(0.12 + reasons.length * 0.2, 0.95);
    return { score, label: score >= cfg.THRESHOLDS.warn ? "FAKE" : "REAL",
             threshold: cfg.THRESHOLDS.warn, assumed: [], reasons, demo: true };
  }

  // extras: { has_company_logo: true, ... } atau {} kalau user tidak mengisi info tambahan
  window.predictJob = async function (text, extras) {
    if (!cfg.API_URL) { await new Promise((r) => setTimeout(r, 600)); return demo(text); }
    const res = await fetch(cfg.API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, ...(extras || {}) })
    });
    if (!res.ok) {
      let detail = "";
      try { const j = await res.json(); if (typeof j.detail === "string") detail = " " + j.detail; } catch (_) {}
      throw new Error("Server membalas status " + res.status + "." + detail);
    }
    return normalize(await res.json());
  };
})();
