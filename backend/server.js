const express = require('express');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'translute-seminovos-secret-2026';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
});

async function q(sql, params = []) {
  const res = await pool.query(sql, params);
  return res.rows;
}
async function q1(sql, params = []) {
  const res = await pool.query(sql, params);
  return res.rows[0] || null;
}

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

function auth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token não fornecido' });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'Token inválido' }); }
}

app.post('/api/login', async (req, res) => {
  try {
    const { usuario, senha } = req.body;
    const user = await q1('SELECT * FROM usuarios WHERE usuario = $1', [usuario]);
    if (!user || !bcrypt.compareSync(senha, user.senha_hash))
      return res.status(401).json({ error: 'Usuário ou senha incorretos' });
    const token = jwt.sign({ id: user.id, usuario: user.usuario, perfil: user.perfil, nome: user.nome }, JWT_SECRET, { expiresIn: '12h' });
    res.json({ token, usuario: user.usuario, perfil: user.perfil, nome: user.nome });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/me', auth, (req, res) => res.json(req.user));

app.get('/api/vendas', auth, async (req, res) => {
  try { res.json(await q('SELECT * FROM vendas ORDER BY criado_em DESC')); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/vendas', auth, async (req, res) => {
  try {
    const { CLI, MODELO, GRUPOS, ANO, PLACA, FIPE, VALOR, PCT, CLASS: CLASSE, COM_R, ENT, MES, ST } = req.body;
    if (!PLACA || !VALOR || !CLI) return res.status(400).json({ error: 'Placa, valor e cliente são obrigatórios' });
    await pool.query("UPDATE objetivos SET STATUS = 'VENDIDO' WHERE PLACA = $1", [PLACA]);
    const row = await q1(
      `INSERT INTO vendas ("CLI","MODELO","GRUPOS","ANO","PLACA","FIPE","VALOR","PCT","CLASS","COM_R","ENT","MES","ST",usuario_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [CLI, MODELO, GRUPOS, ANO, PLACA, FIPE, VALOR, PCT, CLASSE, COM_R, ENT, MES, ST, req.user.id]
    );
    res.status(201).json(row);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/vendas/:id', auth, async (req, res) => {
  try {
    const { CLI, MODELO, GRUPOS, VALOR, FIPE, PCT, CLASS: CLASSE, COM_R, ENT, MES, ST } = req.body;
    const row = await q1(
      `UPDATE vendas SET "CLI"=$1,"MODELO"=$2,"GRUPOS"=$3,"VALOR"=$4,"FIPE"=$5,"PCT"=$6,"CLASS"=$7,
       "COM_R"=$8,"ENT"=$9,"MES"=$10,"ST"=$11,atualizado_em=NOW() WHERE id=$12 RETURNING *`,
      [CLI, MODELO, GRUPOS, VALOR, FIPE, PCT, CLASSE, COM_R, ENT, MES, ST, req.params.id]
    );
    res.json(row);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/vendas/:id', auth, async (req, res) => {
  if (req.user.perfil !== 'admin') return res.status(403).json({ error: 'Sem permissão' });
  try { await pool.query('DELETE FROM vendas WHERE id = $1', [req.params.id]); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/objetivos', auth, async (req, res) => {
  try { res.json(await q('SELECT * FROM objetivos ORDER BY "ANO" DESC')); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/objetivos/:placa/status', auth, async (req, res) => {
  try {
    const row = await q1('UPDATE objetivos SET "STATUS"=$1 WHERE "PLACA"=$2 RETURNING *', [req.body.STATUS, req.params.placa]);
    res.json(row);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/ativos', auth, async (req, res) => {
  try { res.json(await q('SELECT * FROM ativos ORDER BY "ANO" DESC')); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/ativos/:placa/fipe', auth, async (req, res) => {
  try { await pool.query('UPDATE ativos SET "FIPE"=$1 WHERE "PLACA"=$2', [req.body.FIPE, req.params.placa]); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/dashboard', auth, async (req, res) => {
  try {
    const [fat, com, cnt, melhor, objP, objV, capP, patTotal, patCav, patCarr, porMes, porGrupo, fipeSt] = await Promise.all([
      q1('SELECT COALESCE(SUM("VALOR"),0) as total FROM vendas WHERE "ST" != \'CANCELADO\''),
      q1('SELECT COALESCE(SUM("COM_R"),0) as total FROM vendas WHERE "ST" != \'CANCELADO\''),
      q1('SELECT COUNT(*) as n FROM vendas WHERE "ST" != \'CANCELADO\''),
      q1('SELECT "MES", SUM("VALOR") as total FROM vendas WHERE "ST" != \'CANCELADO\' AND "MES" IS NOT NULL GROUP BY "MES" ORDER BY total DESC LIMIT 1'),
      q1('SELECT COUNT(*) as n FROM objetivos WHERE "STATUS" != \'VENDIDO\''),
      q1('SELECT COUNT(*) as n FROM objetivos WHERE "STATUS" = \'VENDIDO\''),
      q1('SELECT COALESCE(SUM("VALOR_APROX"),0) as total FROM objetivos WHERE "STATUS" != \'VENDIDO\''),
      q1('SELECT COALESCE(SUM("FIPE"),0) as total FROM ativos'),
      q1('SELECT COALESCE(SUM("FIPE"),0) as total FROM ativos WHERE "TIPO"=\'CAVALO\''),
      q1('SELECT COALESCE(SUM("FIPE"),0) as total FROM ativos WHERE "TIPO"=\'CARRETA\''),
      q('SELECT "MES", SUM("VALOR") as total FROM vendas WHERE "ST" != \'CANCELADO\' AND "MES" IS NOT NULL GROUP BY "MES" ORDER BY "MES"'),
      q('SELECT "GRUPOS", SUM("VALOR") as total FROM vendas WHERE "ST" != \'CANCELADO\' GROUP BY "GRUPOS" ORDER BY total DESC'),
      q1('SELECT AVG("PCT") as media FROM vendas WHERE "PCT" IS NOT NULL AND "PCT" > 20 AND "ST" != \'CANCELADO\''),
    ]);
    res.json({
      faturamento: parseFloat(fat.total), comissao: parseFloat(com.total),
      negocios: parseInt(cnt.n), melhorMes: melhor,
      objPendentes: parseInt(objP.n), objVendidos: parseInt(objV.n),
      capitalPendente: parseFloat(capP.total),
      patrimonioTotal: parseFloat(patTotal.total),
      patrimonioCavallos: parseFloat(patCav.total),
      patrimonioCarretas: parseFloat(patCarr.total),
      porMes, porGrupo, fipeMedia: parseFloat(fipeSt?.media || 0),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/usuarios', auth, async (req, res) => {
  if (req.user.perfil !== 'admin') return res.status(403).json({ error: 'Sem permissão' });
  try { res.json(await q('SELECT id, usuario, nome, perfil, criado_em FROM usuarios ORDER BY id')); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/usuarios', auth, async (req, res) => {
  if (req.user.perfil !== 'admin') return res.status(403).json({ error: 'Sem permissão' });
  try {
    const { usuario, senha, nome, perfil } = req.body;
    const hash = bcrypt.hashSync(senha, 10);
    const row = await q1('INSERT INTO usuarios (usuario, senha_hash, nome, perfil) VALUES ($1,$2,$3,$4) RETURNING id, usuario, nome, perfil', [usuario, hash, nome, perfil || 'operador']);
    res.status(201).json(row);
  } catch (e) { res.status(400).json({ error: 'Usuário já existe' }); }
});

app.put('/api/usuarios/:id/senha', auth, async (req, res) => {
  if (req.user.perfil !== 'admin') return res.status(403).json({ error: 'Sem permissão' });
  try {
    const hash = bcrypt.hashSync(req.body.senha, 10);
    await pool.query('UPDATE usuarios SET senha_hash=$1 WHERE id=$2', [hash, req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/seed-status', async (req, res) => {
  try {
    const t = await q1("SELECT COUNT(*) as n FROM information_schema.tables WHERE table_name='usuarios'");
    if (!t || parseInt(t.n) === 0) return res.json({ status: 'sem tabelas' });
    const u = await q1('SELECT COUNT(*) as n FROM usuarios');
    const v = await q1('SELECT COUNT(*) as n FROM vendas');
    const a = await q1('SELECT COUNT(*) as n FROM ativos');
    res.json({ usuarios: parseInt(u.n), vendas: parseInt(v.n), ativos: parseInt(a.n) });
  } catch (e) { res.json({ error: e.message }); }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// ── SEED EM BACKGROUND (não bloqueia o servidor) ──────────────────────────────
async function runSeedBackground() {
  try {
    await new Promise(r => setTimeout(r, 3000)); // espera 3s para o servidor estar estável
    const check = await q1("SELECT COUNT(*) as n FROM information_schema.tables WHERE table_name='usuarios'");
    if (check && parseInt(check.n) > 0) {
      const u = await q1('SELECT COUNT(*) as n FROM usuarios');
      if (u && parseInt(u.n) > 0) { console.log('Banco já populado.'); return; }
    }
    console.log('Iniciando seed em background...');
    const seedFn = require('../database/seed_fn.js');
    await seedFn(pool);
    console.log('Seed concluído!');
  } catch (e) {
    console.log('Seed error:', e.message);
  }
}

app.listen(PORT, () => {
  console.log(`\n Translute Seminovos → http://localhost:${PORT}`);
  console.log(` Banco: ${process.env.DATABASE_URL ? 'PostgreSQL OK' : 'DATABASE_URL nao definida!'}\n`);
  runSeedBackground(); // roda sem await — não bloqueia
});
