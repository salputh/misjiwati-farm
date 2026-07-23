const { sql, ensureTables } = require("../_db");

module.exports = async (req, res) => {
  await ensureTables();

  if (req.method === "DELETE") {
    const { id } = req.query;
    await sql`DELETE FROM suhu WHERE id = ${id}`;
    return res.status(200).json({ ok: true });
  }

  res.status(405).json({ error: "Method not allowed" });
};
