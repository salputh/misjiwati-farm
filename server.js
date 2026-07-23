// Server kecil untuk Kandang Suite.
// Menyimpan data Sampel Bobot Ayam & Laporan Suhu ke satu file database JSON
// (data/db.json) yang dipakai bersama oleh semua HP yang membuka aplikasi ini,
// dan menyajikan halaman admin (admin.html) untuk melihat rekap semuanya.

const express = require("express");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

function ensureDb() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ sampel: [], suhu: [] }, null, 2));
  }
}
ensureDb();

function readDb() {
  return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
}

function writeDb(db) {
  const tmpFile = DB_FILE + ".tmp";
  fs.writeFileSync(tmpFile, JSON.stringify(db, null, 2));
  fs.renameSync(tmpFile, DB_FILE);
}

// Antrean sederhana supaya dua request yang datang bersamaan (mis. dua HP
// menyimpan data di saat yang sama) tidak saling menimpa file JSON.
let writeQueue = Promise.resolve();
function withLock(task) {
  const result = writeQueue.then(task);
  writeQueue = result.then(
    () => undefined,
    () => undefined
  );
  return result;
}

const app = express();
app.use(express.json({ limit: "2mb" }));

// ---------- Sampel Bobot Ayam ----------

app.get("/api/sampel", (req, res) => {
  res.json(readDb().sampel);
});

app.post("/api/sampel", async (req, res) => {
  try {
    const record = req.body || {};
    const saved = await withLock(() => {
      const db = readDb();
      const idx = record.id ? db.sampel.findIndex((r) => r.id === record.id) : -1;
      const finalRecord = Object.assign({}, record, { id: record.id || Date.now().toString() });
      if (idx !== -1) {
        db.sampel[idx] = finalRecord;
      } else {
        db.sampel.push(finalRecord);
      }
      writeDb(db);
      return finalRecord;
    });
    res.json(saved);
  } catch (e) {
    res.status(500).json({ error: "Gagal menyimpan data sampel." });
  }
});

app.delete("/api/sampel/:id", async (req, res) => {
  try {
    await withLock(() => {
      const db = readDb();
      db.sampel = db.sampel.filter((r) => r.id !== req.params.id);
      writeDb(db);
    });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "Gagal menghapus data sampel." });
  }
});

// ---------- Laporan Suhu ----------

app.get("/api/suhu", (req, res) => {
  res.json(readDb().suhu);
});

app.post("/api/suhu", async (req, res) => {
  try {
    const entry = req.body || {};
    const saved = await withLock(() => {
      const db = readDb();
      const finalEntry = Object.assign({}, entry, { id: entry.id || Date.now() });
      db.suhu.unshift(finalEntry);
      writeDb(db);
      return finalEntry;
    });
    res.json(saved);
  } catch (e) {
    res.status(500).json({ error: "Gagal menyimpan laporan suhu." });
  }
});

app.delete("/api/suhu/:id", async (req, res) => {
  try {
    await withLock(() => {
      const db = readDb();
      db.suhu = db.suhu.filter((r) => String(r.id) !== String(req.params.id));
      writeDb(db);
    });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "Gagal menghapus laporan suhu." });
  }
});

app.delete("/api/suhu", async (req, res) => {
  try {
    await withLock(() => {
      const db = readDb();
      db.suhu = [];
      writeDb(db);
    });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "Gagal menghapus semua laporan suhu." });
  }
});

// Halaman statis (index.html, sampel.html, suhu.html, admin.html, dst).
app.use(express.static(__dirname));

app.listen(PORT, () => {
  console.log(`Kandang Suite server jalan di http://localhost:${PORT}`);
});
