const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { autenticar, apenasAdmin } = require('../middlewares/authMiddleware');

const router = express.Router();
router.use(autenticar);

// GET /api/usuarios — Lista equipe (ADMIN vê todos com contagem de auditoria)
router.get('/', apenasAdmin, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT
        u.id, u.nome, u.email, u.cargo, u.perfil, u.ativo, u.criado_em,
        COUNT(h.id)::int AS total_movimentacoes
      FROM usuarios u
      LEFT JOIN historico_auditoria h ON h.usuario_id = u.id
      GROUP BY u.id
      ORDER BY u.criado_em ASC
    `);
    return res.json(rows);
  } catch (err) {
    console.error('Erro ao listar usuários:', err);
    return res.status(500).json({ erro: 'Erro ao listar usuários.' });
  }
});

// GET /api/usuarios/:id/acoes — Últimas ações de auditoria de um usuário
router.get('/:id/acoes', apenasAdmin, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT h.id, h.observacao, h.status_novo, h.data_hora, p.nome_completo AS paciente_nome
       FROM historico_auditoria h
       JOIN acompanhamentos a ON a.id = h.acompanhamento_id
       JOIN pacientes p ON p.id = a.paciente_id
       WHERE h.usuario_id = $1
       ORDER BY h.data_hora DESC
       LIMIT 15`,
      [req.params.id]
    );
    return res.json(rows);
  } catch (err) {
    console.error('Erro ao buscar ações do usuário:', err);
    return res.status(500).json({ erro: 'Erro ao buscar movimentações.' });
  }
});

// POST /api/usuarios — Cria usuário autorizado (apenas ADMIN)
router.post('/', apenasAdmin, async (req, res) => {
  try {
    const { nome, email, senha, cargo, perfil } = req.body;
    if (!nome || !email || !senha) {
      return res.status(400).json({ erro: 'Nome, e-mail e senha são obrigatórios.' });
    }

    const perfilValido = perfil === 'ADMIN' ? 'ADMIN' : 'OPERADOR';
    const senhaHash = await bcrypt.hash(senha, 10);

    const { rows } = await db.query(
      `INSERT INTO usuarios (nome, email, senha_hash, cargo, perfil, ativo)
       VALUES ($1, LOWER($2), $3, $4, $5, TRUE)
       RETURNING id, nome, email, cargo, perfil, ativo, criado_em`,
      [nome.trim(), email.trim(), senhaHash, cargo?.trim() || 'Técnico em Regulação', perfilValido]
    );

    return res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ erro: 'Já existe um usuário cadastrado com este e-mail.' });
    }
    console.error('Erro ao criar usuário:', err);
    return res.status(500).json({ erro: 'Erro ao cadastrar usuário.' });
  }
});

// PATCH /api/usuarios/:id/status — Ativar ou desativar acesso (apenas ADMIN)
router.patch('/:id/status', apenasAdmin, async (req, res) => {
  try {
    if (req.params.id === req.usuario.id) {
      return res.status(400).json({ erro: 'Não é possível desativar o próprio usuário.' });
    }

    const { rows } = await db.query(
      `UPDATE usuarios
       SET ativo = NOT ativo
       WHERE id = $1
       RETURNING id, nome, email, cargo, perfil, ativo`,
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ erro: 'Usuário não encontrado.' });
    }
    return res.json(rows[0]);
  } catch (err) {
    console.error('Erro ao alterar status do usuário:', err);
    return res.status(500).json({ erro: 'Erro ao atualizar status do usuário.' });
  }
});

module.exports = router;
