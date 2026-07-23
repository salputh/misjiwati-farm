(function () {
  "use strict";

  const sampelBody = document.getElementById("sampelBody");
  const suhuBody = document.getElementById("suhuBody");
  const emptySampelMsg = document.getElementById("emptySampelMsg");
  const emptySuhuMsg = document.getElementById("emptySuhuMsg");
  const kandangFilter = document.getElementById("kandangFilter");
  const statTotalSampel = document.getElementById("statTotalSampel");
  const statTotalSuhu = document.getElementById("statTotalSuhu");
  const statTotalMati = document.getElementById("statTotalMati");
  const refreshBtn = document.getElementById("refreshBtn");

  const detailOverlay = document.getElementById("detailOverlay");
  const detailText = document.getElementById("detailText");
  const detailTitle = document.getElementById("detailTitle");
  const closeDetailBtn = document.getElementById("closeDetailBtn");
  const loadingOverlay = document.getElementById("loadingOverlay");
  const loadingText = document.getElementById("loadingText");
  const MIN_LOADING_MS = 700;
  let loadingDepth = 0;
  let loadingShownAt = 0;

  function fmt(num, decimals) {
    return Number(num || 0).toLocaleString("id-ID", {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals,
    });
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str == null ? "" : String(str);
    return div.innerHTML;
  }

  function showLoading(message) {
    if (loadingDepth === 0) loadingShownAt = Date.now();
    loadingDepth++;
    if (!loadingOverlay) return;
    loadingText.textContent = message || "Memproses data...";
    loadingOverlay.hidden = false;
    loadingOverlay.setAttribute("aria-hidden", "false");
    document.body.classList.add("loading-active");
  }

  async function hideLoading() {
    loadingDepth = Math.max(loadingDepth - 1, 0);
    if (!loadingOverlay || loadingDepth > 0) return;
    const remaining = Math.max(MIN_LOADING_MS - (Date.now() - loadingShownAt), 0);
    if (remaining > 0) {
      await new Promise(function (resolve) {
        setTimeout(resolve, remaining);
      });
      if (loadingDepth > 0) return;
    }
    loadingOverlay.hidden = true;
    loadingOverlay.setAttribute("aria-hidden", "true");
    loadingText.textContent = "Menyimpan data...";
    document.body.classList.remove("loading-active");
  }

  async function withLoading(message, task) {
    showLoading(message);
    try {
      return await task();
    } finally {
      await hideLoading();
    }
  }

  function sampelMetrics(rec) {
    const s = rec.summary;
    if (!s) {
      return { jenisLabel: "-", jumlahLine: 0, totalEkor: 0, totalKg: 0, abwDisplay: "-" };
    }
    if (s.jenisSampel === "kelamin") {
      return {
        jenisLabel: "Jantan & Betina",
        jumlahLine: s.jantan.jumlahLine + s.betina.jumlahLine,
        totalEkor: s.jantan.totalEkorTersampel + s.betina.totalEkorTersampel,
        totalKg: s.jantan.grandTotalKg + s.betina.grandTotalKg,
        abwDisplay: "J: " + fmt(s.jantan.abwGram, 1) + " / B: " + fmt(s.betina.abwGram, 1),
      };
    }
    return {
      jenisLabel: "Campuran",
      jumlahLine: s.all.jumlahLine,
      totalEkor: s.all.totalEkorTersampel,
      totalKg: s.all.grandTotalKg,
      abwDisplay: fmt(s.all.abwGram, 2),
    };
  }

  async function fetchJson(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error("Gagal memuat data dari server: " + url);
    return res.json();
  }

  function populateKandangFilter(sampelList, suhuList) {
    const current = kandangFilter.value;
    const kandangs = Array.from(new Set(
      sampelList.map(function (r) { return r.kandang; })
        .concat(suhuList.map(function (r) { return r.kandang; }))
        .filter(Boolean)
    )).sort();

    kandangFilter.innerHTML = '<option value="">Semua Kandang</option>';
    kandangs.forEach(function (k) {
      const opt = document.createElement("option");
      opt.value = k;
      opt.textContent = k;
      kandangFilter.appendChild(opt);
    });
    if (kandangs.indexOf(current) !== -1) kandangFilter.value = current;
  }

  function renderSampel(list) {
    const filterValue = kandangFilter.value;
    const filtered = filterValue ? list.filter(function (r) { return r.kandang === filterValue; }) : list;

    const sorted = filtered.slice().sort(function (a, b) {
      return (b.tanggal || "").localeCompare(a.tanggal || "") || String(b.id).localeCompare(String(a.id));
    });

    sampelBody.innerHTML = "";
    sorted.forEach(function (rec) {
      const m = sampelMetrics(rec);
      const tr = document.createElement("tr");
      tr.innerHTML =
        "<td>" + escapeHtml(rec.tanggal || "-") + "</td>" +
        "<td>" + escapeHtml(rec.kandang || "-") + "</td>" +
        "<td>" + escapeHtml(rec.usia != null ? rec.usia : "-") + "</td>" +
        "<td>" + escapeHtml(m.jenisLabel) + "</td>" +
        "<td>" + m.jumlahLine + "</td>" +
        "<td>" + m.totalEkor + "</td>" +
        "<td>" + fmt(m.totalKg, 3) + "</td>" +
        "<td>" + escapeHtml(m.abwDisplay) + "</td>" +
        '<td><button type="button" class="btn btn-danger btn-small delete-sampel-btn">Hapus</button></td>';

      tr.querySelector(".delete-sampel-btn").addEventListener("click", function () {
        deleteSampel(rec.id);
      });

      sampelBody.appendChild(tr);
    });

    emptySampelMsg.classList.toggle("hidden", sorted.length > 0);
    statTotalSampel.textContent = list.length;
  }

  function renderSuhu(list) {
    const filterValue = kandangFilter.value;
    const filtered = filterValue ? list.filter(function (r) { return r.kandang === filterValue; }) : list;

    const sorted = filtered.slice().sort(function (a, b) {
      return (b.tanggal || "").localeCompare(a.tanggal || "") || String(b.id).localeCompare(String(a.id));
    });

    suhuBody.innerHTML = "";
    let totalMati = 0;

    sorted.forEach(function (item) {
      totalMati += Number(item.grandTotal || 0);
      const tr = document.createElement("tr");
      tr.innerHTML =
        "<td>" + escapeHtml(item.tanggal || "-") + "</td>" +
        "<td>" + escapeHtml((item.jam || "-").replace(":", ".")) + "</td>" +
        "<td>" + escapeHtml(item.kandang || "-") + "</td>" +
        "<td>" + escapeHtml(item.usiaAyam != null ? item.usiaAyam : "-") + "</td>" +
        "<td>" + escapeHtml(item.cuaca || "-") + "</td>" +
        "<td>" + escapeHtml(item.grandTotal != null ? item.grandTotal : "-") + "</td>" +
        "<td>" + escapeHtml(item.suhuSet || "-") + "</td>" +
        '<td><button type="button" class="btn btn-ghost btn-small view-suhu-btn">Lihat</button> ' +
        '<button type="button" class="btn btn-danger btn-small delete-suhu-btn">Hapus</button></td>';

      tr.querySelector(".view-suhu-btn").addEventListener("click", function () {
        showSuhuDetail(item);
      });
      tr.querySelector(".delete-suhu-btn").addEventListener("click", function () {
        deleteSuhu(item.id);
      });

      suhuBody.appendChild(tr);
    });

    emptySuhuMsg.classList.toggle("hidden", sorted.length > 0);
    statTotalSuhu.textContent = list.length;
    statTotalMati.textContent = totalMati;
  }

  function showSuhuDetail(item) {
    const kandangLabel = item.kandang ? item.kandang + " — " : "";
    detailTitle.textContent = "Laporan " + kandangLabel + (item.tanggal || "-") + " " + (item.jam || "-").replace(":", ".");
    detailText.value = item.text || "";
    detailOverlay.classList.remove("hidden");
  }

  function closeSuhuDetail() {
    detailOverlay.classList.add("hidden");
    detailText.value = "";
  }

  async function deleteSampel(id) {
    const confirmed = await window.showConfirmDialog({
      title: "Hapus Data Sampel",
      message: "Data sampel yang dihapus akan hilang dari rekap admin. Lanjut hapus data ini?",
      confirmText: "Ya, Hapus",
      cancelText: "Batal",
    });
    if (!confirmed) return;
    try {
      await withLoading("Menghapus data sampel...", async function () {
        const res = await fetch("/api/sampel/" + encodeURIComponent(id), { method: "DELETE" });
        if (!res.ok) throw new Error("Gagal menghapus data sampel.");
        await refresh();
      });
    } catch (e) {
      alert("Gagal menghapus data sampel.");
    }
  }

  async function deleteSuhu(id) {
    const confirmed = await window.showConfirmDialog({
      title: "Hapus Laporan Suhu",
      message: "Laporan suhu yang dihapus akan hilang dari rekap admin. Lanjut hapus data ini?",
      confirmText: "Ya, Hapus",
      cancelText: "Batal",
    });
    if (!confirmed) return;
    try {
      await withLoading("Menghapus laporan suhu...", async function () {
        const res = await fetch("/api/suhu/" + encodeURIComponent(id), { method: "DELETE" });
        if (!res.ok) throw new Error("Gagal menghapus laporan suhu.");
        await refresh();
      });
    } catch (e) {
      alert("Gagal menghapus laporan suhu.");
    }
  }

  async function refresh() {
    try {
      const [sampelList, suhuList] = await Promise.all([
        fetchJson("/api/sampel"),
        fetchJson("/api/suhu"),
      ]);
      populateKandangFilter(sampelList, suhuList);
      renderSampel(sampelList);
      renderSuhu(suhuList);
    } catch (e) {
      alert("Gagal memuat data dari server. Pastikan server (node server.js) sedang berjalan.");
    }
  }

  closeDetailBtn.addEventListener("click", closeSuhuDetail);
  detailOverlay.addEventListener("click", function (e) {
    if (e.target === detailOverlay) closeSuhuDetail();
  });
  kandangFilter.addEventListener("change", refresh);
  refreshBtn.addEventListener("click", refresh);

  refresh();
})();
