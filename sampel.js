(function () {
  "use strict";

  const API_BASE = (window.API_ORIGIN || "") + "/api/sampel";

  const lantaiContainer = document.getElementById("lantaiContainer");
  const emptyLantaiMsg = document.getElementById("emptyLantaiMsg");
  const lineRowTemplate = document.getElementById("lineRowTemplate");

  const kandangInput = document.getElementById("kandangInput");
  const tanggalInput = document.getElementById("tanggalInput");
  const usiaInput = document.getElementById("usiaInput");
  const ekorInput = document.getElementById("ekorInput");
  const ekorJantanInput = document.getElementById("ekorJantanInput");
  const ekorBetinaInput = document.getElementById("ekorBetinaInput");
  const ekorCampuranField = document.getElementById("ekorCampuranField");
  const ekorJantanField = document.getElementById("ekorJantanField");
  const ekorBetinaField = document.getElementById("ekorBetinaField");

  const modeSegmented = document.getElementById("modeSegmented");
  const summaryCampuran = document.getElementById("summaryCampuran");
  const summaryKelamin = document.getElementById("summaryKelamin");

  const saveBtn = document.getElementById("saveBtn");
  const resetBtn = document.getElementById("resetBtn");
  const addLantaiBtn = document.getElementById("addLantaiBtn");

  const editBanner = document.getElementById("editBanner");
  const editBannerLabel = document.getElementById("editBannerLabel");
  const cancelEditBtn = document.getElementById("cancelEditBtn");

  const historyBody = document.getElementById("historyBody");
  const emptyHistoryMsg = document.getElementById("emptyHistoryMsg");
  const loadingOverlay = document.getElementById("loadingOverlay");
  const loadingText = document.getElementById("loadingText");

  let lantaiCounter = 0;
  let editingId = null;
  let currentMode = "campuran"; // 'campuran' | 'kelamin'
  const MIN_LOADING_MS = 700;
  let loadingDepth = 0;
  let loadingShownAt = 0;

  function todayStr() {
    return new Date().toISOString().slice(0, 10);
  }

  function fmt(num, decimals) {
    return Number(num || 0).toLocaleString("id-ID", {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals,
    });
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
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

  // ---------- Mode switching ----------

  function setMode(mode, opts) {
    opts = opts || {};
    if (mode === currentMode && !opts.force) return;

    if (!opts.silent && lantaiContainer.children.length > 0) {
      const ok = confirm(
        "Mengganti jenis sampel akan mengosongkan lantai/line yang sudah diisi di form ini. Lanjutkan?"
      );
      if (!ok) return;
    }

    currentMode = mode;
    lantaiContainer.innerHTML = "";
    toggleEmptyLantaiMsg();

    modeSegmented.querySelectorAll(".segmented-btn").forEach(function (btn) {
      btn.classList.toggle("active", btn.dataset.mode === mode);
    });

    summaryCampuran.classList.toggle("hidden", mode !== "campuran");
    summaryKelamin.classList.toggle("hidden", mode !== "kelamin");

    ekorCampuranField.classList.toggle("hidden", mode !== "campuran");
    ekorJantanField.classList.toggle("hidden", mode !== "kelamin");
    ekorBetinaField.classList.toggle("hidden", mode !== "kelamin");

    recalcAll();
  }

  modeSegmented.addEventListener("click", function (e) {
    const btn = e.target.closest(".segmented-btn");
    if (!btn) return;
    setMode(btn.dataset.mode);
  });

  // ---------- Lantai / Line-group / Line DOM building ----------

  function createLineGroup(labelText, gender) {
    const wrapper = document.createElement("div");
    wrapper.className = "line-group";
    wrapper.dataset.gender = gender;

    let headerHtml = "";
    if (labelText) {
      headerHtml =
        '<div class="line-group-header">' +
        '<span class="line-group-label">' + escapeHtml(labelText) + "</span>" +
        '<span class="line-group-subtotal">Subtotal: <span class="subtotal-value">0</span> kg</span>' +
        "</div>";
    }

    wrapper.innerHTML =
      headerHtml +
      '<div class="table-scroll">' +
      "<table>" +
      "<thead><tr>" +
      "<th>Line</th><th>Sampel 1 (kg)</th><th>Sampel 2 (kg)</th><th>Total Line (kg)</th><th></th>" +
      "</tr></thead>" +
      '<tbody class="line-body"></tbody>' +
      "</table>" +
      "</div>" +
      '<div class="add-line-row">' +
      '<button type="button" class="btn btn-ghost btn-small add-line-btn">+ Tambah Line</button>' +
      "</div>";

    wrapper.querySelector(".add-line-btn").addEventListener("click", function () {
      addLine(wrapper, "", "", "");
      recalcAll();
    });

    return wrapper;
  }

  function addLantai(nama, data) {
    lantaiCounter++;
    const id = "lantai-" + lantaiCounter;

    const block = document.createElement("div");
    block.className = "lantai-block";
    block.dataset.id = id;

    block.innerHTML =
      '<div class="lantai-header">' +
      '<input type="text" class="lantai-name" placeholder="Lantai Bawah / Lantai Atas / dst" value="' +
      escapeHtml(nama || "") +
      '">' +
      '<span class="lantai-subtotal">Subtotal: <span class="lantai-subtotal-value">0</span> kg</span>' +
      '<button type="button" class="btn btn-danger btn-small remove-lantai-btn">Hapus Lantai</button>' +
      "</div>" +
      '<div class="lantai-body"></div>';

    lantaiContainer.appendChild(block);

    block
      .querySelector(".remove-lantai-btn")
      .addEventListener("click", function () {
        block.remove();
        toggleEmptyLantaiMsg();
        recalcAll();
      });

    block.querySelector(".lantai-name").addEventListener("input", recalcAll);

    const body = block.querySelector(".lantai-body");

    if (currentMode === "kelamin") {
      const jantanGroup = createLineGroup("Jantan", "jantan");
      const betinaGroup = createLineGroup("Betina", "betina");
      body.appendChild(jantanGroup);
      body.appendChild(betinaGroup);

      const jantanLines = data && data.jantan && data.jantan.length ? data.jantan : [{ nama: "", s1: "", s2: "" }];
      const betinaLines = data && data.betina && data.betina.length ? data.betina : [{ nama: "", s1: "", s2: "" }];

      jantanLines.forEach(function (l) { addLine(jantanGroup, l.nama, l.s1, l.s2); });
      betinaLines.forEach(function (l) { addLine(betinaGroup, l.nama, l.s1, l.s2); });
    } else {
      const group = createLineGroup(null, "all");
      body.appendChild(group);

      const lines = data && data.lines && data.lines.length ? data.lines : [{ nama: "", s1: "", s2: "" }];
      lines.forEach(function (l) { addLine(group, l.nama, l.s1, l.s2); });
    }

    toggleEmptyLantaiMsg();
    recalcAll();
    return block;
  }

  function addLine(lineGroup, nama, s1, s2) {
    const fragment = lineRowTemplate.content.cloneNode(true);
    const row = fragment.querySelector(".line-row");

    row.querySelector(".line-name").value = nama || "";
    row.querySelector(".line-s1").value = s1 === 0 || s1 ? s1 : "";
    row.querySelector(".line-s2").value = s2 === 0 || s2 ? s2 : "";

    row
      .querySelector(".remove-line-btn")
      .addEventListener("click", function () {
        row.remove();
        recalcAll();
      });

    row.querySelectorAll("input").forEach(function (inp) {
      inp.addEventListener("input", recalcAll);
    });

    lineGroup.querySelector(".line-body").appendChild(row);
  }

  function toggleEmptyLantaiMsg() {
    const hasLantai = lantaiContainer.children.length > 0;
    emptyLantaiMsg.classList.toggle("hidden", hasLantai);
  }

  // ---------- Calculation ----------

  function computeSummary(bucket, ekorPerSampel) {
    const jumlahTitikSampel = bucket.lines * 2;
    const totalEkorTersampel = jumlahTitikSampel * ekorPerSampel;
    const abwGram = totalEkorTersampel > 0 ? (bucket.kg * 1000) / totalEkorTersampel : 0;
    return {
      grandTotalKg: bucket.kg,
      jumlahLine: bucket.lines,
      jumlahTitikSampel: jumlahTitikSampel,
      totalEkorTersampel: totalEkorTersampel,
      abwGram: abwGram,
    };
  }

  function setSummaryFields(container, summary) {
    if (!container) return;
    const set = function (field, value) {
      const el = container.querySelector('[data-field="' + field + '"]');
      if (el) el.textContent = value;
    };
    set("grandTotalKg", fmt(summary.grandTotalKg, 3));
    set("jumlahLine", summary.jumlahLine);
    set("jumlahTitikSampel", summary.jumlahTitikSampel);
    set("totalEkorTersampel", summary.totalEkorTersampel);
    set("abwGram", fmt(summary.abwGram, 2));
  }

  function recalcAll() {
    const buckets = {
      all: { kg: 0, lines: 0 },
      jantan: { kg: 0, lines: 0 },
      betina: { kg: 0, lines: 0 },
    };

    lantaiContainer.querySelectorAll(".lantai-block").forEach(function (block) {
      let lantaiTotal = 0;

      block.querySelectorAll(".line-group").forEach(function (group) {
        const gender = group.dataset.gender;
        let groupTotal = 0;

        group.querySelectorAll(".line-row").forEach(function (row) {
          const s1 = parseFloat(row.querySelector(".line-s1").value) || 0;
          const s2 = parseFloat(row.querySelector(".line-s2").value) || 0;
          const total = s1 + s2;
          row.querySelector(".line-total").textContent = fmt(total, 3);
          groupTotal += total;
          buckets[gender].lines++;
        });

        buckets[gender].kg += groupTotal;
        const subtotalEl = group.querySelector(".subtotal-value");
        if (subtotalEl) subtotalEl.textContent = fmt(groupTotal, 3);

        lantaiTotal += groupTotal;
      });

      block.querySelector(".lantai-subtotal-value").textContent = fmt(lantaiTotal, 3);
    });

    if (currentMode === "kelamin") {
      const ekorJantan = parseFloat(ekorJantanInput.value) || 0;
      const ekorBetina = parseFloat(ekorBetinaInput.value) || 0;
      const jantanSummary = computeSummary(buckets.jantan, ekorJantan);
      const betinaSummary = computeSummary(buckets.betina, ekorBetina);

      setSummaryFields(summaryKelamin.querySelector('[data-gender-summary="jantan"]'), jantanSummary);
      setSummaryFields(summaryKelamin.querySelector('[data-gender-summary="betina"]'), betinaSummary);

      return { jenisSampel: "kelamin", jantan: jantanSummary, betina: betinaSummary };
    }

    const ekorPerSampel = parseFloat(ekorInput.value) || 0;
    const allSummary = computeSummary(buckets.all, ekorPerSampel);
    setSummaryFields(summaryCampuran, allSummary);
    return { jenisSampel: "campuran", all: allSummary };
  }

  // ---------- Collect / Load form data ----------

  function collectFormData() {
    const lantais = [];

    lantaiContainer.querySelectorAll(".lantai-block").forEach(function (block) {
      const nama = block.querySelector(".lantai-name").value;
      const entry = { nama: nama };

      block.querySelectorAll(".line-group").forEach(function (group) {
        const gender = group.dataset.gender;
        const lines = [];

        group.querySelectorAll(".line-row").forEach(function (row) {
          lines.push({
            nama: row.querySelector(".line-name").value,
            s1: parseFloat(row.querySelector(".line-s1").value) || 0,
            s2: parseFloat(row.querySelector(".line-s2").value) || 0,
          });
        });

        if (gender === "all") entry.lines = lines;
        else entry[gender] = lines;
      });

      lantais.push(entry);
    });

    return {
      jenisSampel: currentMode,
      kandang: kandangInput.value.trim(),
      tanggal: tanggalInput.value,
      usia: parseFloat(usiaInput.value) || 0,
      ekorPerSampel: parseFloat(ekorInput.value) || 0,
      ekorJantan: parseFloat(ekorJantanInput.value) || 0,
      ekorBetina: parseFloat(ekorBetinaInput.value) || 0,
      lantais: lantais,
    };
  }

  function loadFormData(data) {
    setMode(data.jenisSampel || "campuran", { silent: true, force: true });

    kandangInput.value = data.kandang || "";
    tanggalInput.value = data.tanggal || todayStr();
    usiaInput.value = data.usia || data.usia === 0 ? data.usia : "";
    ekorInput.value = data.ekorPerSampel || 20;
    // Fall back to the shared ekorPerSampel for records saved before jantan/betina had separate counts.
    ekorJantanInput.value = data.ekorJantan || data.ekorPerSampel || 20;
    ekorBetinaInput.value = data.ekorBetina || data.ekorPerSampel || 20;

    (data.lantais || []).forEach(function (l) {
      addLantai(l.nama, l);
    });

    toggleEmptyLantaiMsg();
    recalcAll();
  }

  function resetForm() {
    kandangInput.value = "";
    tanggalInput.value = todayStr();
    usiaInput.value = "";
    ekorInput.value = 20;
    ekorJantanInput.value = 20;
    ekorBetinaInput.value = 20;
    editingId = null;
    editBanner.classList.add("hidden");
    setMode("campuran", { silent: true, force: true });
  }

  // ---------- History (database JSON di server) ----------

  async function loadHistoryList() {
    try {
      const res = await fetch(API_BASE);
      if (!res.ok) throw new Error("Gagal memuat riwayat dari server.");
      return await res.json();
    } catch (e) {
      console.error(e);
      return [];
    }
  }

  async function saveRecordToServer(record) {
    const res = await fetch(API_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(record),
    });
    if (!res.ok) throw new Error("Gagal menyimpan ke server.");
    return res.json();
  }

  async function deleteRecordOnServer(id) {
    const res = await fetch(API_BASE + "/" + encodeURIComponent(id), { method: "DELETE" });
    if (!res.ok) throw new Error("Gagal menghapus di server.");
  }

  function historyRowMetrics(rec) {
    const s = rec.summary;
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

  async function renderHistoryTable() {
    const list = await loadHistoryList();
    historyBody.innerHTML = "";

    list
      .slice()
      .sort(function (a, b) {
        return (b.tanggal || "").localeCompare(a.tanggal || "") || b.id.localeCompare(a.id);
      })
      .forEach(function (rec) {
        const m = historyRowMetrics(rec);
        const tr = document.createElement("tr");
        tr.innerHTML =
          "<td>" + escapeHtml(rec.tanggal || "-") + "</td>" +
          "<td>" + escapeHtml(rec.kandang || "-") + "</td>" +
          "<td>" + (rec.usia || rec.usia === 0 ? rec.usia : "-") + "</td>" +
          "<td>" + escapeHtml(m.jenisLabel) + "</td>" +
          "<td>" + m.jumlahLine + "</td>" +
          "<td>" + m.totalEkor + "</td>" +
          "<td>" + fmt(m.totalKg, 3) + "</td>" +
          "<td>" + m.abwDisplay + "</td>" +
          '<td><button type="button" class="btn btn-ghost btn-small edit-record-btn">Edit</button> ' +
          '<button type="button" class="btn btn-ghost btn-small image-record-btn">🖼️ Gambar</button> ' +
          '<button type="button" class="btn btn-danger btn-small delete-record-btn">Hapus</button></td>';

        tr.querySelector(".edit-record-btn").addEventListener("click", function () {
          editRecord(rec);
        });
        tr.querySelector(".image-record-btn").addEventListener("click", function () {
          showImagePreview(rec);
        });
        tr.querySelector(".delete-record-btn").addEventListener("click", function () {
          deleteRecord(rec.id);
        });

        historyBody.appendChild(tr);
      });

    emptyHistoryMsg.classList.toggle("hidden", list.length > 0);
  }

  async function saveToHistory() {
    const data = collectFormData();

    if (!data.kandang) {
      alert("Isi nama/nomor kandang terlebih dahulu.");
      return;
    }
    if (data.lantais.length === 0) {
      alert("Tambahkan minimal satu lantai dan line sebelum menyimpan.");
      return;
    }

    const summary = recalcAll();
    const record = Object.assign({}, data, { summary: summary });
    if (editingId) record.id = editingId;

    saveBtn.disabled = true;
    try {
      await withLoading("Menyimpan riwayat sampel...", async function () {
        await saveRecordToServer(record);
        await renderHistoryTable();
      });
      resetForm();
    } catch (e) {
      alert("Gagal menyimpan ke server. Pastikan koneksi ke server masih aktif, lalu coba lagi.");
    } finally {
      saveBtn.disabled = false;
    }
  }

  function editRecord(rec) {
    loadFormData(rec);
    editingId = rec.id;
    editBannerLabel.textContent = (rec.kandang || "-") + " (" + (rec.tanggal || "-") + ")";
    editBanner.classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function deleteRecord(id) {
    const confirmed = await window.showConfirmDialog({
      title: "Hapus Riwayat Sampel",
      message: "Riwayat sampel yang dihapus tidak bisa dikembalikan. Lanjut hapus data ini?",
      confirmText: "Ya, Hapus",
      cancelText: "Batal",
    });
    if (!confirmed) return;
    try {
      await withLoading("Menghapus riwayat sampel...", async function () {
        await deleteRecordOnServer(id);
        await renderHistoryTable();
      });
    } catch (e) {
      alert("Gagal menghapus di server. Coba lagi.");
      return;
    }
    if (editingId === id) resetForm();
  }

  // ---------- Image export ----------

  const copyImageBtn = document.getElementById("copyImageBtn");
  const imagePreviewOverlay = document.getElementById("imagePreviewOverlay");
  const resultImagePreview = document.getElementById("resultImagePreview");
  const downloadImageBtn = document.getElementById("downloadImageBtn");
  const imageStatusText = document.getElementById("imageStatusText");
  const closePreviewBtn = document.getElementById("closePreviewBtn");

  // Pure, DOM-independent version of the recalculation above — works for the
  // live form (via collectFormData) and for saved history records alike.
  function summarizeLantaiData(data) {
    const buckets = {
      all: { kg: 0, lines: 0 },
      jantan: { kg: 0, lines: 0 },
      betina: { kg: 0, lines: 0 },
    };

    const lantaiSummaries = (data.lantais || []).map(function (l) {
      function withTotals(rows) {
        return (rows || []).map(function (r) {
          return { nama: r.nama, s1: r.s1 || 0, s2: r.s2 || 0, total: (r.s1 || 0) + (r.s2 || 0) };
        });
      }

      if (data.jenisSampel === "kelamin") {
        const jantanRows = withTotals(l.jantan);
        const betinaRows = withTotals(l.betina);
        jantanRows.forEach(function (r) { buckets.jantan.kg += r.total; buckets.jantan.lines++; });
        betinaRows.forEach(function (r) { buckets.betina.kg += r.total; buckets.betina.lines++; });
        return {
          nama: l.nama,
          jantan: jantanRows,
          betina: betinaRows,
          jantanSubtotal: jantanRows.reduce(function (s, r) { return s + r.total; }, 0),
          betinaSubtotal: betinaRows.reduce(function (s, r) { return s + r.total; }, 0),
        };
      }

      const rows = withTotals(l.lines);
      rows.forEach(function (r) { buckets.all.kg += r.total; buckets.all.lines++; });
      return { nama: l.nama, lines: rows, subtotal: rows.reduce(function (s, r) { return s + r.total; }, 0) };
    });

    if (data.jenisSampel === "kelamin") {
      return {
        lantaiSummaries: lantaiSummaries,
        jantan: computeSummary(buckets.jantan, data.ekorJantan || 0),
        betina: computeSummary(buckets.betina, data.ekorBetina || 0),
      };
    }
    return { lantaiSummaries: lantaiSummaries, all: computeSummary(buckets.all, data.ekorPerSampel || 0) };
  }

  function roundRectPath(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.lineTo(x + w - rr, y);
    ctx.arcTo(x + w, y, x + w, y + rr, rr);
    ctx.lineTo(x + w, y + h - rr);
    ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
    ctx.lineTo(x + rr, y + h);
    ctx.arcTo(x, y + h, x, y + h - rr, rr);
    ctx.lineTo(x, y + rr);
    ctx.arcTo(x, y, x + rr, y, rr);
    ctx.closePath();
  }

  function layoutPills(measureCtx, items, maxWidth, font) {
    const padX = 10;
    const gapX = 6;
    measureCtx.font = font;
    const lines = [];
    let current = [];
    let currentWidth = 0;
    items.forEach(function (text) {
      const w = measureCtx.measureText(text).width + padX * 2;
      if (current.length > 0 && currentWidth + gapX + w > maxWidth) {
        lines.push(current);
        current = [];
        currentWidth = 0;
      }
      if (current.length > 0) currentWidth += gapX;
      current.push({ text: text, width: w });
      currentWidth += w;
    });
    if (current.length) lines.push(current);
    return lines;
  }

  function buildResultCanvas(data, summarized) {
    const WIDTH = 700;
    const PAD_X = 20;
    const TABLE_W = WIDTH - PAD_X * 2;
    const MARGIN = 18;
    const CARD_RADIUS = 16;

    const H = {
      title: 50,
      section: 24,
      label: 20,
      colHeader: 20,
      row: 34,
      ringkasan: 34,
      summaryTitle: 22,
      summaryRow: 32,
      highlight: 40,
      gap: 6,
      gapSmall: 6,
      padBottom: 14,
    };
    const COL_GAP = 20;
    const COL_FRACTIONS = [0.2, 0.27, 0.27, 0.26];

    const GRAD = ["#4338ca", "#7e22ce", "#db2777"];
    const COLOR = {
      accent: "#f97316",
      accentDark: "#c2410c",
      accentSoft: "#fef2e8",
      accent2: "#0ea5e9",
      accent2Dark: "#0369a1",
      accent2Soft: "#e6f6fd",
      pillBg: "#eef1f6",
      pillText: "#475569",
      headerBg: "#f5f6f8",
      text: "#1f2430",
      textMuted: "#5b6472",
      border: "rgba(31,36,48,0.10)",
      rowAlt: "#fafbfc",
    };

    const PILL_H = 22;
    const PILL_FONT = "bold 10.5px -apple-system, Arial, sans-serif";
    const measureCanvas = document.createElement("canvas");
    const measureCtx = measureCanvas.getContext("2d");

    const jenisLabel = data.jenisSampel === "kelamin" ? "Per Jenis Kelamin (Jantan & Betina)" : "Campuran (Semua Ayam)";
    const ekorLabel = data.jenisSampel === "kelamin"
      ? "Ekor/Sampel — Jantan: " + (data.ekorJantan || 0) + ", Betina: " + (data.ekorBetina || 0)
      : "Ekor/Sampel: " + (data.ekorPerSampel || 0);
    const usiaLabel = "Usia: " + (data.usia || 0) + " hari";
    const pillLines = layoutPills(measureCtx, [data.kandang || "-", data.tanggal || "-", usiaLabel, jenisLabel, ekorLabel], TABLE_W, PILL_FONT);
    const pillsHeight = 8 + pillLines.length * PILL_H + (pillLines.length - 1) * 6 + 8;

    function buildLantaiColumnOps(l) {
      const colOps = [];
      let colHeight = 0;
      colOps.push({ type: "colSection", text: (l.nama || "Lantai").toUpperCase() });
      colHeight += H.section;

      function addGroup(rows, subtotalLabel, subtotalValue, labelText, variant) {
        if (labelText) {
          colOps.push({ type: "colLabel", text: labelText, variant: variant });
          colHeight += H.label;
        }
        colOps.push({ type: "colHeader" });
        colHeight += H.colHeader;
        rows.forEach(function (r) {
          colOps.push({ type: "colRow", cells: [r.nama || "-", fmt(r.s1, 3), fmt(r.s2, 3), fmt(r.total, 3)] });
          colHeight += H.row;
        });
        colOps.push({ type: "colSubtotal", label: subtotalLabel, value: subtotalValue, variant: variant });
        colHeight += H.row;
      }

      if (data.jenisSampel === "kelamin") {
        addGroup(l.jantan, "Subtotal Jantan", l.jantanSubtotal, "JANTAN", "accent");
        addGroup(l.betina, "Subtotal Betina", l.betinaSubtotal, "BETINA", "accent2");
      } else {
        addGroup(l.lines, "Subtotal", l.subtotal, null, "accent");
      }

      return { ops: colOps, height: colHeight };
    }

    const ops = [];
    const push = function (op) { ops.push(op); };

    push({ type: "title" });
    push({ type: "pills", lines: pillLines, height: pillsHeight });

    const lantaiColumns = summarized.lantaiSummaries.map(buildLantaiColumnOps);
    for (let i = 0; i < lantaiColumns.length; i += 2) {
      const colA = lantaiColumns[i];
      const colB = lantaiColumns[i + 1];
      const pairHeight = colB ? Math.max(colA.height, colB.height) : colA.height;
      push({ type: "lantaiPair", colA: colA, colB: colB, height: pairHeight });
      push({ type: "gap" });
    }

    push({ type: "gap" });
    push({ type: "ringkasan" });

    function pushSummaryBlock(title, s, variant) {
      if (title) push({ type: "summaryTitle", text: title, variant: variant });
      push({ type: "summaryRow", label: "Total Berat (kg)", value: fmt(s.grandTotalKg, 3) });
      push({ type: "summaryRow", label: "Jumlah Line", value: String(s.jumlahLine) });
      push({ type: "summaryRow", label: "Jumlah Titik Sampel", value: String(s.jumlahTitikSampel) });
      push({ type: "summaryRow", label: "Total Ekor Tersampel", value: String(s.totalEkorTersampel) });
      push({ type: "highlight", label: "ABW per Ekor (gram)" + (title ? " — " + title : ""), value: fmt(s.abwGram, 2), variant: variant });
    }

    if (data.jenisSampel === "kelamin") {
      pushSummaryBlock("JANTAN", summarized.jantan, "accent");
      push({ type: "gapSmall" });
      pushSummaryBlock("BETINA", summarized.betina, "accent2");
    } else {
      pushSummaryBlock(null, summarized.all, "brand");
    }

    push({ type: "padBottom" });

    const heightOf = function (op) {
      if (typeof op.height === "number") return op.height;
      switch (op.type) {
        case "title": return H.title;
        case "gap": return H.gap;
        case "gapSmall": return H.gapSmall;
        case "ringkasan": return H.ringkasan;
        case "summaryTitle": return H.summaryTitle;
        case "summaryRow": return H.summaryRow;
        case "highlight": return H.highlight;
        case "padBottom": return H.padBottom;
        default: return 0;
      }
    };

    const contentHeight = ops.reduce(function (sum, op) { return sum + heightOf(op); }, 0);

    const scale = 2;
    const canvas = document.createElement("canvas");
    canvas.width = (WIDTH + MARGIN * 2) * scale;
    canvas.height = (contentHeight + MARGIN * 2) * scale;
    const ctx = canvas.getContext("2d");
    ctx.scale(scale, scale);
    ctx.textBaseline = "middle";

    ctx.save();
    ctx.shadowColor = "rgba(31, 20, 60, 0.28)";
    ctx.shadowBlur = 28;
    ctx.shadowOffsetY = 10;
    ctx.fillStyle = "#ffffff";
    roundRectPath(ctx, MARGIN, MARGIN, WIDTH, contentHeight, CARD_RADIUS);
    ctx.fill();
    ctx.restore();

    ctx.save();
    roundRectPath(ctx, MARGIN, MARGIN, WIDTH, contentHeight, CARD_RADIUS);
    ctx.clip();
    ctx.translate(MARGIN, MARGIN);

    function brandGradient(y0, y1) {
      const grad = ctx.createLinearGradient(0, y0, WIDTH, y1);
      grad.addColorStop(0, GRAD[0]);
      grad.addColorStop(0.55, GRAD[1]);
      grad.addColorStop(1, GRAD[2]);
      return grad;
    }

    function variantColors(variant) {
      if (variant === "accent2") return { soft: COLOR.accent2Soft, dark: COLOR.accent2Dark, solid: COLOR.accent2 };
      return { soft: COLOR.accentSoft, dark: COLOR.accentDark, solid: COLOR.accent };
    }

    function drawLantaiColumn(descriptor, x0, y0, colWidth) {
      const colWidths = COL_FRACTIONS.map(function (f) { return f * colWidth; });
      let yy = y0;
      let colZebra = 0;

      descriptor.ops.forEach(function (op) {
        const hh = op.type === "colSection" ? H.section
          : op.type === "colLabel" ? H.label
          : op.type === "colHeader" ? H.colHeader
          : H.row;

        if (op.type === "colSection") {
          ctx.fillStyle = COLOR.headerBg;
          ctx.fillRect(x0, yy, colWidth, hh);
          ctx.fillStyle = COLOR.accent;
          ctx.fillRect(x0, yy, 3, hh);
          ctx.fillStyle = COLOR.text;
          ctx.font = "bold 12px -apple-system, Arial, sans-serif";
          ctx.textAlign = "left";
          ctx.fillText(op.text, x0 + 12, yy + hh / 2);
        } else if (op.type === "colLabel") {
          const c = variantColors(op.variant);
          ctx.fillStyle = c.soft;
          ctx.fillRect(x0, yy, colWidth, hh);
          ctx.fillStyle = c.dark;
          ctx.font = "bold 10px -apple-system, Arial, sans-serif";
          ctx.textAlign = "left";
          ctx.fillText(op.text, x0 + 8, yy + hh / 2);
        } else if (op.type === "colHeader") {
          ctx.fillStyle = COLOR.headerBg;
          ctx.fillRect(x0, yy, colWidth, hh);
          ctx.fillStyle = COLOR.textMuted;
          ctx.font = "bold 10px -apple-system, Arial, sans-serif";
          ctx.textAlign = "left";
          let x = x0 + 8;
          ["Line", "S1", "S2", "Total"].forEach(function (label, i) {
            ctx.fillText(label, x, yy + hh / 2);
            x += colWidths[i];
          });
          colZebra = 0;
        } else if (op.type === "colRow") {
          ctx.fillStyle = colZebra % 2 === 0 ? "#ffffff" : COLOR.rowAlt;
          ctx.fillRect(x0, yy, colWidth, hh);
          ctx.fillStyle = COLOR.text;
          ctx.font = "15px -apple-system, Arial, sans-serif";
          ctx.textAlign = "left";
          let x = x0 + 8;
          op.cells.forEach(function (cell, i) {
            ctx.fillText(String(cell), x, yy + hh / 2);
            x += colWidths[i];
          });
          ctx.strokeStyle = COLOR.border;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x0, yy + hh - 0.5);
          ctx.lineTo(x0 + colWidth, yy + hh - 0.5);
          ctx.stroke();
          colZebra++;
        } else if (op.type === "colSubtotal") {
          const c = variantColors(op.variant);
          ctx.fillStyle = c.soft;
          ctx.fillRect(x0, yy, colWidth, hh);
          ctx.fillStyle = c.dark;
          ctx.font = "bold 14px -apple-system, Arial, sans-serif";
          ctx.textAlign = "left";
          ctx.fillText(op.label, x0 + 8, yy + hh / 2);
          ctx.textAlign = "right";
          ctx.fillText(fmt(op.value, 3) + " kg", x0 + colWidth - 8, yy + hh / 2);
        }

        ctx.textAlign = "left";
        yy += hh;
      });
    }

    let y = 0;
    let zebra = 0;

    ops.forEach(function (op) {
      const h = heightOf(op);

      if (op.type === "title") {
        ctx.fillStyle = brandGradient(y, y + h);
        ctx.fillRect(0, y, WIDTH, h);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 15.5px -apple-system, Arial, sans-serif";
        ctx.textAlign = "left";
        ctx.fillText("Rekap Hasil Sampel Bobot Ayam", PAD_X, y + 19);
        ctx.font = "10px -apple-system, Arial, sans-serif";
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.fillText("Satuan sampel: kg  ·  ABW akhir: gram", PAD_X, y + 36);
      } else if (op.type === "pills") {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, y, WIDTH, h);
        let py = y + 8;
        op.lines.forEach(function (line) {
          let px = PAD_X;
          line.forEach(function (item) {
            ctx.fillStyle = COLOR.pillBg;
            roundRectPath(ctx, px, py, item.width, PILL_H, PILL_H / 2);
            ctx.fill();
            ctx.fillStyle = COLOR.pillText;
            ctx.font = PILL_FONT;
            ctx.textAlign = "left";
            ctx.fillText(item.text, px + 10, py + PILL_H / 2 + 1);
            px += item.width + 6;
          });
          py += PILL_H + 6;
        });
      } else if (op.type === "lantaiPair") {
        const colWidth = op.colB ? (TABLE_W - COL_GAP) / 2 : TABLE_W;
        drawLantaiColumn(op.colA, PAD_X, y, colWidth);
        if (op.colB) drawLantaiColumn(op.colB, PAD_X + colWidth + COL_GAP, y, colWidth);
      } else if (op.type === "ringkasan") {
        ctx.fillStyle = brandGradient(y, y + h);
        ctx.fillRect(0, y, WIDTH, h);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 12px -apple-system, Arial, sans-serif";
        ctx.textAlign = "left";
        ctx.fillText("Ringkasan Hasil", PAD_X, y + h / 2);
      } else if (op.type === "summaryTitle") {
        const c = variantColors(op.variant);
        ctx.fillStyle = c.soft;
        ctx.fillRect(PAD_X, y, TABLE_W, h);
        ctx.fillStyle = c.dark;
        ctx.font = "bold 10px -apple-system, Arial, sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(op.text, PAD_X + 8, y + h / 2);
      } else if (op.type === "summaryRow") {
        ctx.fillStyle = zebra % 2 === 0 ? "#ffffff" : COLOR.rowAlt;
        ctx.fillRect(PAD_X, y, TABLE_W, h);
        ctx.fillStyle = COLOR.textMuted;
        ctx.font = "11px -apple-system, Arial, sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(op.label, PAD_X + 8, y + h / 2);
        ctx.fillStyle = COLOR.text;
        ctx.font = "bold 15px -apple-system, Arial, sans-serif";
        ctx.textAlign = "right";
        ctx.fillText(op.value, PAD_X + TABLE_W - 8, y + h / 2);
        ctx.strokeStyle = COLOR.border;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(PAD_X, y + h - 0.5);
        ctx.lineTo(PAD_X + TABLE_W, y + h - 0.5);
        ctx.stroke();
        zebra++;
      } else if (op.type === "highlight") {
        if (op.variant === "brand") {
          ctx.fillStyle = brandGradient(y, y + h);
        } else {
          ctx.fillStyle = variantColors(op.variant).solid;
        }
        ctx.fillRect(PAD_X, y, TABLE_W, h);
        ctx.fillStyle = "rgba(255,255,255,0.88)";
        ctx.font = "bold 10.5px -apple-system, Arial, sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(op.label, PAD_X + 10, y + h / 2);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 19px -apple-system, Arial, sans-serif";
        ctx.textAlign = "right";
        ctx.fillText(op.value, PAD_X + TABLE_W - 10, y + h / 2);
        zebra = 0;
      }

      ctx.textAlign = "left";
      y += h;
    });

    ctx.restore();

    return canvas;
  }

  async function copyCanvasToClipboard(canvas) {
    const blob = await new Promise(function (resolve) { canvas.toBlob(resolve, "image/png"); });
    if (!blob) throw new Error("Gagal membuat gambar dari canvas.");
    if (!navigator.clipboard || !window.ClipboardItem) throw new Error("unsupported");
    await navigator.clipboard.write([new window.ClipboardItem({ "image/png": blob })]);
  }

  async function showImagePreview(data) {
    const summarized = summarizeLantaiData(data);
    const canvas = buildResultCanvas(data, summarized);
    const dataUrl = canvas.toDataURL("image/png");

    resultImagePreview.src = dataUrl;
    downloadImageBtn.href = dataUrl;
    downloadImageBtn.download = "rekap-sampel-" + (data.kandang || "kandang").replace(/\s+/g, "-") + "-" + (data.tanggal || todayStr()) + ".png";

    imagePreviewOverlay.classList.remove("hidden");
    imageStatusText.textContent = "Menyalin ke clipboard...";

    try {
      await copyCanvasToClipboard(canvas);
      imageStatusText.textContent = "✅ Tersalin ke clipboard — langsung paste (Ctrl/Cmd+V) di chat.";
    } catch (err) {
      imageStatusText.textContent = "Tidak bisa menyalin otomatis di browser ini. Tekan & tahan gambar di bawah untuk menyalin/simpan, atau unduh.";
    }
  }

  function closeImagePreview() {
    imagePreviewOverlay.classList.add("hidden");
    resultImagePreview.src = "";
  }

  copyImageBtn.addEventListener("click", function () {
    const data = collectFormData();
    if (data.lantais.length === 0) {
      alert("Tambahkan minimal satu lantai dan line sebelum membuat gambar.");
      return;
    }
    showImagePreview(data);
  });

  closePreviewBtn.addEventListener("click", closeImagePreview);
  imagePreviewOverlay.addEventListener("click", function (e) {
    if (e.target === imagePreviewOverlay) closeImagePreview();
  });

  // ---------- Event bindings ----------

  addLantaiBtn.addEventListener("click", function () {
    addLantai("", null);
  });

  ekorInput.addEventListener("input", recalcAll);
  ekorJantanInput.addEventListener("input", recalcAll);
  ekorBetinaInput.addEventListener("input", recalcAll);
  saveBtn.addEventListener("click", saveToHistory);
  resetBtn.addEventListener("click", resetForm);
  cancelEditBtn.addEventListener("click", resetForm);

  // ---------- Init ----------

  tanggalInput.value = todayStr();
  toggleEmptyLantaiMsg();
  renderHistoryTable();
  recalcAll();
})();
