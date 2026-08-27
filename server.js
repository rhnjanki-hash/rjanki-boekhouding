try { require("dotenv").config(); } catch {}
const express = require("express");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("path");
const { pool, init } = require("./db");

const app = express();
const SECRET = process.env.JWT_SECRET || "dev-secret-verander-dit";
const COOKIE = "rj_token";
const PROD = process.env.NODE_ENV === "production" || !!process.env.RENDER;

app.use(express.json({ limit: "8mb" }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

// ---------- auth helpers ----------
function auth(req, res, next) {
  const t = req.cookies[COOKIE];
  if (!t) return res.status(401).json({ error: "Niet ingelogd" });
  try { req.user = jwt.verify(t, SECRET); next(); }
  catch { res.status(401).json({ error: "Sessie verlopen" }); }
}
const ROLE_LEVEL = { viewer: 1, gebruiker: 2, beheerder: 3 };
const minRole = r => (req, res, next) =>
  ROLE_LEVEL[req.user.role] >= ROLE_LEVEL[r] ? next() : res.status(403).json({ error: "Geen rechten hiervoor" });

// ---------- auth routes ----------
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body || {};
  const { rows } = await pool.query("SELECT * FROM users WHERE username=$1", [String(username || "").trim().toLowerCase()]);
  const u = rows[0];
  if (!u || !(await bcrypt.compare(password || "", u.password_hash)))
    return res.status(401).json({ error: "Gebruikersnaam of wachtwoord klopt niet" });
  const token = jwt.sign({ id: u.id, username: u.username, role: u.role }, SECRET, { expiresIn: "12h" });
  res.cookie(COOKIE, token, { httpOnly: true, sameSite: "lax", secure: PROD, maxAge: 12 * 3600 * 1000 });
  res.json({ username: u.username, role: u.role });
});
app.post("/api/logout", (req, res) => { res.clearCookie(COOKIE); res.json({ ok: true }); });
app.get("/api/me", auth, (req, res) => res.json({ username: req.user.username, role: req.user.role }));
app.post("/api/me/password", auth, async (req, res) => {
  const { oldPassword, newPassword } = req.body || {};
  const { rows } = await pool.query("SELECT * FROM users WHERE id=$1", [req.user.id]);
  if (!(await bcrypt.compare(oldPassword || "", rows[0].password_hash))) return res.status(400).json({ error: "Huidig wachtwoord klopt niet" });
  if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: "Nieuw wachtwoord: minimaal 6 tekens" });
  await pool.query("UPDATE users SET password_hash=$1 WHERE id=$2", [await bcrypt.hash(newPassword, 10), req.user.id]);
  res.json({ ok: true });
});

// ---------- user management (beheerder) ----------
app.get("/api/users", auth, minRole("beheerder"), async (req, res) => {
  const { rows } = await pool.query("SELECT id,username,role,created_at FROM users ORDER BY username");
  res.json(rows);
});
app.post("/api/users", auth, minRole("beheerder"), async (req, res) => {
  const { username, password, role } = req.body || {};
  const u = String(username || "").trim().toLowerCase();
  if (!u || !password || password.length < 6) return res.status(400).json({ error: "Gebruikersnaam en wachtwoord (min. 6 tekens) verplicht" });
  if (!ROLE_LEVEL[role]) return res.status(400).json({ error: "Ongeldige rol" });
  try {
    await pool.query("INSERT INTO users (username,password_hash,role) VALUES ($1,$2,$3)", [u, await bcrypt.hash(password, 10), role]);
    res.json({ ok: true });
  } catch { res.status(400).json({ error: "Gebruikersnaam bestaat al" }); }
});
app.put("/api/users/:id", auth, minRole("beheerder"), async (req, res) => {
  const { role, password } = req.body || {};
  if (role) {
    if (!ROLE_LEVEL[role]) return res.status(400).json({ error: "Ongeldige rol" });
    if (Number(req.params.id) === req.user.id && role !== "beheerder") return res.status(400).json({ error: "Je kunt je eigen beheerdersrol niet verwijderen" });
    await pool.query("UPDATE users SET role=$1 WHERE id=$2", [role, req.params.id]);
  }
  if (password) {
    if (password.length < 6) return res.status(400).json({ error: "Wachtwoord: minimaal 6 tekens" });
    await pool.query("UPDATE users SET password_hash=$1 WHERE id=$2", [await bcrypt.hash(password, 10), req.params.id]);
  }
  res.json({ ok: true });
});
app.delete("/api/users/:id", auth, minRole("beheerder"), async (req, res) => {
  if (Number(req.params.id) === req.user.id) return res.status(400).json({ error: "Je kunt jezelf niet verwijderen" });
  await pool.query("DELETE FROM users WHERE id=$1", [req.params.id]);
  res.json({ ok: true });
});

// ---------- records ----------
const TYPES = { bon: "bonnen", rekening: "rekeningen", lening: "leningen" };
app.get("/api/data", auth, async (req, res) => {
  const { rows } = await pool.query("SELECT id,type,data FROM records ORDER BY updated_at");
  const out = { bonnen: [], rekeningen: [], leningen: [] };
  rows.forEach(r => out[TYPES[r.type]].push({ ...r.data, id: r.id }));
  const s = await pool.query("SELECT value FROM settings WHERE key='valuta'");
  out.valuta = s.rows[0]?.value || "SRD";
  res.json(out);
});
app.put("/api/settings/valuta", auth, minRole("gebruiker"), async (req, res) => {
  await pool.query("INSERT INTO settings (key,value) VALUES ('valuta',$1) ON CONFLICT (key) DO UPDATE SET value=$1", [req.body.valuta]);
  res.json({ ok: true });
});
app.put("/api/records/:type/:id", auth, minRole("gebruiker"), async (req, res) => {
  if (!TYPES[req.params.type]) return res.status(400).json({ error: "Onbekend type" });
  const data = { ...req.body }; delete data.id;
  await pool.query(
    `INSERT INTO records (id,type,data,created_by) VALUES ($1,$2,$3,$4)
     ON CONFLICT (id) DO UPDATE SET data=$3, updated_at=now()`,
    [req.params.id, req.params.type, data, req.user.username]);
  res.json({ ok: true });
});
app.delete("/api/records/:type/:id", auth, minRole("gebruiker"), async (req, res) => {
  await pool.query("DELETE FROM records WHERE id=$1", [req.params.id]);
  await pool.query("DELETE FROM images WHERE id=$1", [req.params.id]);
  res.json({ ok: true });
});

// ---------- images ----------
app.get("/api/images/:id", auth, async (req, res) => {
  const { rows } = await pool.query("SELECT data FROM images WHERE id=$1", [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: "Niet gevonden" });
  res.json({ data: rows[0].data });
});
app.put("/api/images/:id", auth, minRole("gebruiker"), async (req, res) => {
  await pool.query("INSERT INTO images (id,data) VALUES ($1,$2) ON CONFLICT (id) DO UPDATE SET data=$2", [req.params.id, req.body.data]);
  res.json({ ok: true });
});

app.get("*", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.use((err, req, res, next) => { console.error(err); res.status(500).json({ error: "Serverfout" }); });

init().then(() => {
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log("Boekhouding draait op poort " + port));
}).catch(e => { console.error("Database fout:", e.message); process.exit(1); });
