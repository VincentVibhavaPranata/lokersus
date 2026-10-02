// Logika halaman utama: baca form, panggil predictJob(), tampilkan hasil.
(function () {
  const cfg = window.LOKERSUS_CONFIG;
  const $ = (id) => document.getElementById(id);
  const input = $("job-text"), count = $("count"), btn = $("check-btn");
  const result = $("result"), errorBox = $("error"), meter = $("meter");
  const FLAGS = ["has_company_profile", "has_requirements", "has_benefits", "has_salary_range",
                 "has_company_logo", "telecommuting", "has_questions"];
  let touched = false;

  const SAMPLE = "WORK FROM HOME! Earn $500-$5000 per week! No experience needed! Join our team and start making money immediately! 100% guaranteed! Apply NOW! Limited spots available!!! Data entry specialists needed.";

  const VERDICTS = {
    ok:   ["Kayaknya legit", "Belum ada tanda kuat lowongan palsu. Tetap cek nama perusahaan dan kontak resminya."],
    warn: ["Hati-hati, ada yang janggal", "Model menandai ini sebagai kemungkinan palsu. Cek dulu sebelum kirim data pribadi."],
    sus:  ["Sus banget", "Sangat mirip lowongan palsu. Jangan transfer uang atau kirim dokumen pribadi."]
  };

  function level(r) {
    if (r.label ? r.label === "REAL" : r.score < cfg.THRESHOLDS.warn) return "ok";
    return r.score < cfg.THRESHOLDS.sus ? "warn" : "sus";
  }

  // Model dilatih dengan data bahasa Inggris, jadi teks Indonesia tidak bisa dinilai dengan benar.
  const ID_WORDS = /\b(yang|dan|untuk|dengan|dari|akan|atau|kami|anda|gaji|lowongan|pengalaman|dibutuhkan|perusahaan|kerja|tanpa|segera)\b/gi;
  const EN_WORDS = /\b(the|and|to|of|for|with|you|we|will|experience|required|skills|team|work)\b/gi;
  function looksIndonesian(t) {
    const id = (t.match(ID_WORDS) || []).length, en = (t.match(EN_WORDS) || []).length;
    return id >= 3 && id > en;
  }

  function extras() {
    if (!touched) return {};
    const o = {};
    FLAGS.forEach((f) => { o[f] = $(f).checked; });
    return o;
  }

  function showResult(r, indo) {
    const lv = level(r), pct = Math.round(r.score * 100);
    result.dataset.level = lv;
    $("verdict").textContent = VERDICTS[lv][0];
    $("verdict-note").textContent = VERDICTS[lv][1];
    $("score").textContent = "Peluang lowongan palsu: " + pct + "%";
    meter.style.setProperty("--w", r.threshold * 100 + "%");
    meter.style.setProperty("--s", cfg.THRESHOLDS.sus * 100 + "%");
    $("marker").style.left = pct + "%";
    const list = $("reasons");
    list.innerHTML = "";
    r.reasons.forEach((t) => { const li = document.createElement("li"); li.textContent = t; list.appendChild(li); });
    $("reasons-wrap").hidden = list.children.length === 0;
    $("demo-note").hidden = !r.demo;
    $("lang-note").hidden = !indo;
    $("assumed-note").hidden = !(r.assumed && r.assumed.length);
    result.hidden = false;
    result.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  input.maxLength = cfg.MAX_CHARS;
  input.addEventListener("input", () => { count.textContent = input.value.length + " / " + cfg.MAX_CHARS; });
  FLAGS.forEach((f) => $(f).addEventListener("change", () => { touched = true; }));

  $("sample-btn").addEventListener("click", () => {
    input.value = SAMPLE;
    input.dispatchEvent(new Event("input"));
    input.focus();
  });

  $("check-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    errorBox.hidden = true;
    if (text.length < 30) {
      errorBox.textContent = "Tempel teks lowongan yang lebih lengkap dulu (minimal 30 karakter).";
      errorBox.hidden = false;
      return;
    }
    btn.disabled = true; btn.textContent = "Lagi dicek...";
    try {
      showResult(await window.predictJob(text, extras()), looksIndonesian(text));
    } catch (err) {
      errorBox.textContent = "Gagal mengecek lowongan. " + err.message;
      errorBox.hidden = false;
    } finally {
      btn.disabled = false; btn.textContent = "Cek lowongan";
    }
  });
})();
