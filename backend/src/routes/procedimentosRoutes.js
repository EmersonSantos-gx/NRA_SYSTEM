const express = require('express');
const db = require('../config/db');
const { autenticar } = require('../middlewares/authMiddleware');

const router = express.Router();
router.use(autenticar);

// GET /api/procedimentos
router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT
        pr.id, pr.nome, pr.codigo_sigtap, pr.especialidade, pr.ativo, pr.criado_em,
        COUNT(a.id)::int AS total_pacientes
      FROM procedimentos pr
      LEFT JOIN acompanhamentos a ON a.procedimento_id = pr.id
      GROUP BY pr.id
      ORDER BY pr.nome ASC
    `);
    return res.json(rows);
  } catch (err) {
    console.error('Erro ao listar procedimentos:', err);
    return res.status(500).json({ erro: 'Erro ao listar procedimentos.' });
  }
});

// POST /api/procedimentos
router.post('/', async (req, res) => {
  try {
    const { nome, codigo_sigtap, especialidade } = req.body;
    if (!nome || !especialidade) {
      return res.status(400).json({ erro: 'Nome e especialidade são obrigatórios.' });
    }

    const { rows } = await db.query(
      `INSERT INTO procedimentos (nome, codigo_sigtap, especialidade, ativo)
       VALUES ($1, $2, $3, TRUE)
       RETURNING *`,
      [nome.trim(), codigo_sigtap?.trim() || '00.00.00.000-0', especialidade.trim()]
    );
    return res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Erro ao criar procedimento:', err);
    return res.status(500).json({ erro: 'Erro ao cadastrar procedimento.' });
  }
});

// PATCH /api/procedimentos/:id/status
router.patch('/:id/status', async (req, res) => {
  try {
    const { rows } = await db.query(
      `UPDATE procedimentos SET ativo = NOT ativo WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ erro: 'Procedimento não encontrado.' });
    }
    return res.json(rows[0]);
  } catch (err) {
    console.error('Erro ao atualizar procedimento:', err);
    return res.status(500).json({ erro: 'Erro ao atualizar procedimento.' });
  }
});

module.exports = router;