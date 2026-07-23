const { sql, ensureTables } = require("../_db");

module.exports = async (req, res) => {
  await ensureTables();

  if (req.method === "GET") {
    const rows = await sql`SELECT data FROM sampel ORDER BY created_at ASC`;
    return res.status(200).json(rows.map((r) => r.data));
  }

  if (req.method === "POST") {
    const record = req.body || {};
    const id = record.id || Date.now().toString();
    const finalRecord = Object.assign({}, record, { id });
    await sql`
      INSERT INTO sampel (id, data)
      VALUES (${id}, ${JSON.stringify(finalRecord)}::jsonb)
      ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data
    `;
    return res.status(200).json(finalRecord);
  }

  res.status(405).json({ error: "Method not allowed" });
};
