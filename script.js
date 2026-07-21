// ===== Konstanta =====
const FORM_STORAGE_KEY = "laporanSuhu.form";
const HISTORY_STORAGE_KEY = "laporanSuhu.history";
const DAY_NAMES = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jum'at", "Sabtu"];

const FIELD_IDS = [
  "tanggal", "jam", "cuaca",
  "atasPanel", "atasDepan", "atasTengah", "atasBelakang", "atasLembap",
  "bawahPanel", "bawahDepan", "bawahTengah", "bawahBelakang", "bawahLembap",
  "kondisiAyam",
  "matiMalamAtas", "matiMalamBawah", "matiPagiAtas", "matiPagiBawah", "matiSiangAtas", "matiSiangBawah",
  "pakanPersen", "pakanGram", "suhuSet"
];

// Field yang tidak dibawa ke pengisian berikutnya (harus diisi ulang tiap laporan)
const FIELDS_NOT_REMEMBERED = new Set([
  "tanggal", "jam",
  "matiMalamAtas", "matiMalamBawah", "matiPagiAtas", "matiPagiBawah", "matiSiangAtas", "matiSiangBawah"
]);

// Field angka yang harus kembali ke 0 saat form dikosongkan (tombol "Selesai")
const ZERO_RESET_IDS = [
  "atasPanel", "atasDepan", "atasTengah", "atasBelakang", "atasLembap",
  "bawahPanel", "bawahDepan", "bawahTengah", "bawahBelakang", "bawahLembap",
  "matiMalamAtas", "matiMalamBawah", "matiPagiAtas", "matiPagiBawah", "matiSiangAtas", "matiSiangBawah",
  "pakanPersen", "pakanGram", "suhuSet"
];

// ===== Helper =====
function pad2(n) {
  return String(n).padStart(2, "0");
}

function val(id) {
  return document.getElementById(id).value;
}

function num(id) {
  return Number(val(id)) || 0;
}

function temp(id) {
  return num(id).toFixed(1);
}

function pct(id) {
  return num(id).toFixed(1);
}

// Field suhu/kelembapan: paksa pemisah desimal pakai titik (.), bukan koma (,)
// karena keyboard angka di sebagian HP Indonesia mengetik koma secara default.
function sanitizeDecimalInput(e) {
  const el = e.target;
  const cursorFromEnd = el.value.length - el.selectionEnd;
  let cleaned = el.value.replace(/,/g, ".").replace(/[^0-9.]/g, "");
  const firstDot = cleaned.indexOf(".");
  if (firstDot !== -1) {
    cleaned = cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, "");
  }
  if (cleaned !== el.value) {
    el.value = cleaned;
    const pos = el.value.length - cursorFromEnd;
    el.setSelectionRange(pos, pos);
  }
}

// ===== Isi default tanggal & jam =====
function setDefaultDateTime() {
  const now = new Date();
  const tanggalEl = document.getElementById("tanggal");
  const jamEl = document.getElementById("jam");
  if (!tanggalEl.value) {
    tanggalEl.value = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
  }
  if (!jamEl.value) {
    jamEl.value = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
  }
}

// ===== Simpan & muat isian form terakhir =====
function saveFormValues() {
  const data = {};
  FIELD_IDS.forEach((id) => {
    if (!FIELDS_NOT_REMEMBERED.has(id)) {
      data[id] = val(id);
    }
  });
  localStorage.setItem(FORM_STORAGE_KEY, JSON.stringify(data));
}

function loadFormValues() {
  const raw = localStorage.getItem(FORM_STORAGE_KEY);
  if (!raw) return;
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    return;
  }
  FIELD_IDS.forEach((id) => {
    if (data[id] !== undefined) {
      document.getElementById(id).value = data[id];
    }
  });
}

// ===== Total kematian ayam =====
function updateTotals() {
  const malam = num("matiMalamAtas") + num("matiMalamBawah");
  const pagi = num("matiPagiAtas") + num("matiPagiBawah");
  const siang = num("matiSiangAtas") + num("matiSiangBawah");
  const grand = malam + pagi + siang;
  document.getElementById("grandTotalPreview").textContent = grand;
  return { malam, pagi, siang, grand };
}

// ===== Format tanggal & jam =====
function formatTanggal() {
  const [y, m, d] = val("tanggal").split("-");
  const dateObj = new Date(Number(y), Number(m) - 1, Number(d));
  const dayName = DAY_NAMES[dateObj.getDay()];
  return `${dayName}.${d}-${m}-${y}`;
}

function formatJam() {
  return val("jam").replace(":", ".");
}

// Format khusus untuk kartu gambar, mis. "Selasa, 21-07-2026 · 00.02 WIB"
function formatTanggalKartu() {
  const [y, m, d] = val("tanggal").split("-");
  const dateObj = new Date(Number(y), Number(m) - 1, Number(d));
  const dayName = DAY_NAMES[dateObj.getDay()];
  return `${dayName}, ${d}-${m}-${y} · ${formatJam()} WIB`;
}

// ===== Susun teks laporan =====
function buildReportText() {
  const totals = updateTotals();
  const lines = [
    "*_Lap.kondisi cuaca dan suhu:_*",
    formatTanggal(),
    `Jam: ${formatJam()} wib`,
    `-kondisi cuaca saat ini: *_${val("cuaca")}_*`,
    `1. Suhu kandang lantai atas ${temp("atasPanel")}°(panel)`,
    `* suhu bagian depan ${temp("atasDepan")}°`,
    `* suhu bagian tengah ${temp("atasTengah")}°`,
    `* suhu bagian belakang ${temp("atasBelakang")}°`,
    `* Kelembapan ${num("atasLembap")}%`,
    "",
    `2. Suhu kandang lantai bawah ${temp("bawahPanel")}°(panel)`,
    `* suhu bagian depan ${temp("bawahDepan")}°`,
    `* suhu bagian tengah ${temp("bawahTengah")}°`,
    `* suhu bagian belakang ${temp("bawahBelakang")}°`,
    `* Kelembapan ${num("bawahLembap")}%`,
    "",
    `3. Kondisi ayam ${val("kondisiAyam") || "makan dan minum"}.`,
    "",
    "4. Ayam mati",
    "*Malam*",
    `Atas = ${num("matiMalamAtas")}`,
    `Bawah = ${num("matiMalamBawah")}`,
    `Total = ${totals.malam} ekor`,
    "",
    "*Pagi*",
    `Atas = ${num("matiPagiAtas")}`,
    `Bawah = ${num("matiPagiBawah")}`,
    `Total = ${totals.pagi} ekor`,
    "",
    "*Siang*",
    `Atas = ${num("matiSiangAtas")}`,
    `Bawah = ${num("matiSiangBawah")}`,
    `Total = ${totals.siang} ekor`,
    "",
    `*Grand Total = ${totals.grand} ekor*`,
    "",
    `5. Estimasi sisa pakan= ${num("pakanPersen")}%(${num("pakanGram")} gram)`,
    "",
    `*_Ket: suhu sett ${temp("suhuSet")}°_*`
  ];
  return { text: lines.join("\n"), totals };
}

// ===== Susun kartu laporan (versi gambar) =====
const WEATHER_ICONS = {
  "Cerah": "☀️",
  "Berawan": "☁️",
  "Mendung": "🌥️",
  "Hujan": "🌧️",
  "Hujan Deras": "⛈️"
};

function buildReportCardHTML() {
  const totals = updateTotals();
  const cuaca = val("cuaca");
  const icon = WEATHER_ICONS[cuaca] || "☁️";

  return `
    <p class="report-card__title">Laporan kondisi cuaca dan suhu</p>
    <p class="report-card__subtitle">${formatTanggalKartu()}</p>

    <div class="report-card__pill">
      <span>${icon}</span>
      <span>Cuaca saat ini: <strong>${cuaca.toLowerCase()}</strong></span>
    </div>

    <p class="report-card__section-label">Suhu dan kelembapan</p>
    <table>
      <thead>
        <tr><th>Lantai</th><th>Depan</th><th>Tengah</th><th>Belakang</th><th>Panel</th><th>RH</th></tr>
      </thead>
      <tbody>
        <tr>
          <td>Atas</td>
          <td>${temp("atasDepan")}°</td>
          <td>${temp("atasTengah")}°</td>
          <td>${temp("atasBelakang")}°</td>
          <td>${temp("atasPanel")}°</td>
          <td>${pct("atasLembap")}%</td>
        </tr>
        <tr>
          <td>Bawah</td>
          <td>${temp("bawahDepan")}°</td>
          <td>${temp("bawahTengah")}°</td>
          <td>${temp("bawahBelakang")}°</td>
          <td>${temp("bawahPanel")}°</td>
          <td>${pct("bawahLembap")}%</td>
        </tr>
      </tbody>
    </table>

    <p class="report-card__section-label">Mortalitas per sesi</p>
    <table>
      <thead>
        <tr><th>Sesi</th><th>Atas</th><th>Bawah</th><th>Total</th></tr>
      </thead>
      <tbody>
        <tr>
          <td>Malam</td>
          <td>${num("matiMalamAtas")}</td>
          <td>${num("matiMalamBawah")}</td>
          <td>${totals.malam}</td>
        </tr>
        <tr>
          <td>Pagi</td>
          <td>${num("matiPagiAtas")}</td>
          <td>${num("matiPagiBawah")}</td>
          <td>${totals.pagi}</td>
        </tr>
        <tr>
          <td>Siang</td>
          <td>${num("matiSiangAtas")}</td>
          <td>${num("matiSiangBawah")}</td>
          <td>${totals.siang}</td>
        </tr>
        <tr class="grand-row">
          <td>Grand total</td>
          <td>${num("matiMalamAtas") + num("matiPagiAtas") + num("matiSiangAtas")}</td>
          <td>${num("matiMalamBawah") + num("matiPagiBawah") + num("matiSiangBawah")}</td>
          <td class="total-value">${totals.grand}</td>
        </tr>
      </tbody>
    </table>

    <div class="report-card__feed">
      <span>🌾 Estimasi sisa pakan</span>
      <strong>${num("pakanPersen")}% (${num("pakanGram")} gram)</strong>
    </div>

    <p class="report-card__footer">Keterangan: suhu setting ${temp("suhuSet")}°</p>
  `;
}

// ===== Riwayat (history) =====
function loadHistory() {
  const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

function saveHistory(list) {
  localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(list));
}

function addHistoryEntry(text, totals) {
  const list = loadHistory();
  list.unshift({
    id: Date.now(),
    tanggal: val("tanggal"),
    jam: val("jam"),
    cuaca: val("cuaca"),
    grandTotal: totals.grand,
    suhuSet: temp("suhuSet"),
    text: text
  });
  saveHistory(list);
  renderHistory();
}

function deleteHistoryEntry(id) {
  const list = loadHistory().filter((item) => item.id !== id);
  saveHistory(list);
  renderHistory();
}

function formatHistoryLabel(item) {
  const [y, m, d] = item.tanggal.split("-");
  return `${d}-${m}-${y} ${item.jam.replace(":", ".")}`;
}

function renderHistory() {
  const list = loadHistory();
  const listEl = document.getElementById("historyList");
  const emptyEl = document.getElementById("historyEmpty");
  const countEl = document.getElementById("historyCount");

  countEl.textContent = list.length;
  listEl.innerHTML = "";

  if (list.length === 0) {
    emptyEl.classList.remove("d-none");
    return;
  }
  emptyEl.classList.add("d-none");

  list.forEach((item) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "list-group-item list-group-item-action";
    btn.innerHTML = `
      <div class="d-flex justify-content-between align-items-center">
        <strong>${formatHistoryLabel(item)}</strong>
        <span class="badge text-bg-danger">${item.grandTotal} mati</span>
      </div>
      <small class="text-muted">Cuaca: ${item.cuaca} &middot; Suhu set: ${item.suhuSet}°</small>
    `;
    btn.addEventListener("click", () => openHistoryModal(item));
    listEl.appendChild(btn);
  });
}

let activeHistoryId = null;
let historyModalInstance = null;

function openHistoryModal(item) {
  activeHistoryId = item.id;
  document.getElementById("historyModalTitle").textContent = `Laporan ${formatHistoryLabel(item)}`;
  document.getElementById("historyModalText").value = item.text;
  if (!historyModalInstance) {
    historyModalInstance = new bootstrap.Modal(document.getElementById("historyModal"));
  }
  historyModalInstance.show();
}

// ===== Salin ke clipboard (dengan fallback) =====
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    return false;
  }
}

function copyViaTextarea(textareaEl) {
  textareaEl.focus();
  textareaEl.select();
  try {
    return document.execCommand("copy");
  } catch (e) {
    return false;
  }
}

// ===== Event: Buat Laporan =====
document.getElementById("generateBtn").addEventListener("click", () => {
  const form = document.getElementById("reportForm");
  if (!form.reportValidity()) return;

  saveFormValues();
  const { text, totals } = buildReportText();

  const outputText = document.getElementById("outputText");
  outputText.value = text;
  document.getElementById("reportCard").innerHTML = buildReportCardHTML();
  document.getElementById("outputSection").classList.remove("d-none");
  document.getElementById("outputSection").scrollIntoView({ behavior: "smooth", block: "start" });

  const copyBtn = document.getElementById("copyBtn");
  copyBtn.classList.remove("copied");
  copyBtn.textContent = "Salin ke WhatsApp";

  const copyImageBtn = document.getElementById("copyImageBtn");
  copyImageBtn.classList.remove("copied");
  copyImageBtn.textContent = "Salin Gambar";

  addHistoryEntry(text, totals);
});

// ===== Event: Salin hasil laporan =====
document.getElementById("copyBtn").addEventListener("click", async () => {
  const outputText = document.getElementById("outputText");
  const btn = document.getElementById("copyBtn");
  const hint = document.getElementById("copyHint");

  let copied = await copyText(outputText.value);
  if (!copied) copied = copyViaTextarea(outputText);

  if (copied) {
    btn.classList.add("copied");
    btn.textContent = "Tersalin ✓";
    hint.textContent = "Teks sudah disalin. Buka WhatsApp lalu tempel (paste) di grup.";
    setTimeout(() => {
      btn.classList.remove("copied");
      btn.textContent = "Salin ke WhatsApp";
    }, 2500);
  } else {
    hint.textContent = "Tidak bisa menyalin otomatis. Teks sudah dipilih, tekan lama lalu pilih Salin.";
  }
});

// ===== Event: ganti tampilan Teks / Gambar =====
document.querySelectorAll("#outputModeTabs .nav-link").forEach((tabBtn) => {
  tabBtn.addEventListener("click", () => {
    document.querySelectorAll("#outputModeTabs .nav-link").forEach((b) => b.classList.remove("active"));
    tabBtn.classList.add("active");
    const mode = tabBtn.dataset.mode;
    document.getElementById("outputTeksPane").classList.toggle("d-none", mode !== "teks");
    document.getElementById("outputGambarPane").classList.toggle("d-none", mode !== "gambar");
  });
});

// ===== Render kartu laporan menjadi gambar PNG =====
async function renderReportCardToBlob() {
  const card = document.getElementById("reportCard");
  const canvas = await html2canvas(card, { scale: 2, backgroundColor: "#ffffff" });
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

// ===== Event: salin hasil laporan sebagai gambar =====
document.getElementById("copyImageBtn").addEventListener("click", async () => {
  const btn = document.getElementById("copyImageBtn");
  const hint = document.getElementById("copyImageHint");
  const originalLabel = "Salin Gambar";

  btn.disabled = true;
  btn.textContent = "Memproses...";
  try {
    const blob = await renderReportCardToBlob();
    if (!navigator.clipboard || !window.ClipboardItem) {
      throw new Error("Clipboard image API tidak didukung");
    }
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    btn.classList.add("copied");
    btn.textContent = "Tersalin ✓";
    hint.textContent = "Gambar sudah disalin. Buka WhatsApp lalu tempel (paste) di grup.";
    setTimeout(() => {
      btn.classList.remove("copied");
      btn.textContent = originalLabel;
    }, 2500);
  } catch (e) {
    btn.textContent = originalLabel;
    hint.textContent = "Browser ini tidak mendukung salin gambar otomatis. Pakai tombol Unduh Gambar, lalu kirim sebagai foto di WhatsApp.";
  } finally {
    btn.disabled = false;
  }
});

// ===== Event: unduh hasil laporan sebagai gambar =====
document.getElementById("downloadImageBtn").addEventListener("click", async () => {
  const btn = document.getElementById("downloadImageBtn");
  const originalLabel = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Memproses...";
  try {
    const blob = await renderReportCardToBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `laporan-suhu-${val("tanggal")}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (e) {
    alert("Gagal membuat gambar. Coba lagi.");
  } finally {
    btn.disabled = false;
    btn.textContent = originalLabel;
  }
});

// ===== Event: Selesai (kosongkan form untuk laporan berikutnya) =====
document.getElementById("doneBtn").addEventListener("click", () => {
  document.getElementById("reportForm").reset();
  ZERO_RESET_IDS.forEach((id) => {
    document.getElementById(id).value = "0";
  });
  setDefaultDateTime();
  updateTotals();

  document.getElementById("outputSection").classList.add("d-none");
  document.getElementById("outputText").value = "";
  document.getElementById("reportCard").innerHTML = "";

  document.querySelectorAll("#outputModeTabs .nav-link").forEach((b) => b.classList.remove("active"));
  document.querySelector('#outputModeTabs .nav-link[data-mode="teks"]').classList.add("active");
  document.getElementById("outputTeksPane").classList.remove("d-none");
  document.getElementById("outputGambarPane").classList.add("d-none");

  window.scrollTo({ top: 0, behavior: "smooth" });
});

// ===== Event: pemisah desimal selalu titik =====
document.querySelectorAll(".decimal-input").forEach((el) => {
  el.addEventListener("input", sanitizeDecimalInput);
});

// ===== Event: total kematian live =====
["matiMalamAtas", "matiMalamBawah", "matiPagiAtas", "matiPagiBawah", "matiSiangAtas", "matiSiangBawah"]
  .forEach((id) => document.getElementById(id).addEventListener("input", updateTotals));

// ===== Event: modal riwayat (salin & hapus) =====
document.getElementById("historyModalCopy").addEventListener("click", async () => {
  const textarea = document.getElementById("historyModalText");
  let copied = await copyText(textarea.value);
  if (!copied) copied = copyViaTextarea(textarea);
  const btn = document.getElementById("historyModalCopy");
  btn.textContent = copied ? "Tersalin ✓" : "Gagal, salin manual";
  setTimeout(() => { btn.textContent = "Salin"; }, 2000);
});

document.getElementById("historyModalDelete").addEventListener("click", () => {
  if (activeHistoryId === null) return;
  if (confirm("Hapus laporan ini dari riwayat?")) {
    deleteHistoryEntry(activeHistoryId);
    historyModalInstance.hide();
  }
});

// ===== Event: hapus semua riwayat =====
document.getElementById("clearHistoryBtn").addEventListener("click", () => {
  if (loadHistory().length === 0) return;
  if (confirm("Hapus semua riwayat laporan di HP ini?")) {
    saveHistory([]);
    renderHistory();
  }
});

// ===== Inisialisasi =====
setDefaultDateTime();
loadFormValues();
updateTotals();
renderHistory();
