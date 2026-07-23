const { sql, ensureTables } = require("../_db");

module.exports = async (req, res) => {
  await ensureTables();

  if (req.method === "GET") {
    const rows = await sql`SELECT data FROM suhu ORDER BY created_at DESC`;
    return res.status(200).json(rows.map((r) => r.data));
  }

  if (req.method === "POST") {
    const entry = req.body || {};
    const id = entry.id ? String(entry.id) : Date.now().toString();
    const finalEntry = Object.assign({}, entry, { id });
    await sql`
      INSERT INTO suhu (id, data)
      VALUES (${id}, ${JSON.stringify(finalEntry)}::jsonb)
      ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data
    `;
    return res.status(200).json(finalEntry);
  }

  if (req.method === "DELETE") {
    await sql`DELETE FROM suhu`;
    return res.status(200).json({ ok: true });
  }

  res.status(405).json({ error: "Method not allowed" });
};
