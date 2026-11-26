const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { autenticar, apenasAdmin } = require('../middlewares/authMiddleware');

const router = express.Router();
router.use(autenticar);

// GET /api/usuarios — Lista equipe com contagem total de atividades
router.get('/', apenasAdmin, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT
        u.id, u.nome, u.email, u.cargo, u.perfil, u.ativo, u.criado_em,
        (
          SELECT COUNT(*)::int FROM historico_auditoria h WHERE h.usuario_id = u.id
        ) + (
          SELECT COUNT(*)::int FROM tarefas t WHERE t.coordenador_id = u.id OR t.colaborador_id = u.id
        ) AS total_movimentacoes
      FROM usuarios u
      ORDER BY u.criado_em ASC
    `);
    return res.json(rows);
  } catch (err) {
    console.error('Erro ao listar usuários:', err);
    return res.status(500).json({ erro: 'Erro ao listar usuários.' });
  }
});

// GET /api/usuarios/:id/acoes — Log unificado de atividades (Auditoria Clínica + Tarefas)
router.get('/:id/acoes', apenasAdmin, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT * FROM (
        SELECT
          h.id::text AS id,
          'CLINICA' AS tipo,
          p.nome_completo AS referencia,
          h.observacao AS descricao,
          h.data_hora AS data_hora
        FROM historico_auditoria h
        JOIN acompanhamentos a ON a.id = h.acompanhamento_id
        JOIN pacientes p ON p.id = a.paciente_id
        WHERE h.usuario_id = $1

        UNION ALL

        SELECT
          t.id::text AS id,
          'TAREFA' AS tipo,
          t.titulo AS referencia,
          CASE
            WHEN t.coordenador_id = $1 THEN 'Distribuiu tarefa (' || t.status || ')'
            ELSE 'Recebeu/executou tarefa (' || t.status || ')'
          END AS descricao,
          COALESCE(t.finalizado_em, t.iniciado_em, t.recebido_em, t.criado_em) AS data_hora
        FROM tarefas t
        WHERE t.coordenador_id = $1 OR t.colaborador_id = $1
      ) log_unificado
      ORDER BY data_hora DESC
      LIMIT 30`,
      [req.params.id]
    );
    return res.json(rows);
  } catch (err) {
    console.error('Erro ao buscar log de atividade:', err);
    return res.status(500).json({ erro: 'Erro ao buscar log de atividade do usuário.' });
  }
});

// POST /api/usuarios — Cria novo usuário autorizado
router.post('/', apenasAdmin, async (req, res) => {
  try {
    const { nome, email, senha, cargo, perfil } = req.body;
    if (!nome?.trim() || !email?.trim() || !senha) {
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

// PUT /api/usuarios/:id — Editar dados cadastrais do usuário
router.put('/:id', apenasAdmin, async (req, res) => {
  try {
    const { nome, email, cargo, perfil } = req.body;
    if (!nome?.trim() || !email?.trim()) {
      return res.status(400).json({ erro: 'Nome e e-mail são obrigatórios.' });
    }

    const perfilValido = perfil === 'ADMIN' ? 'ADMIN' : 'OPERADOR';

    if (req.params.id === req.usuario.id && perfilValido !== 'ADMIN') {
      return res.status(400).json({ erro: 'Você não pode rebaixar o seu próprio perfil de Administrador.' });
    }

    const { rows } = await db.query(
      `UPDATE usuarios
       SET nome = $1,
           email = LOWER($2),
           cargo = $3,
           perfil = $4
       WHERE id = $5
       RETURNING id, nome, email, cargo, perfil, ativo, criado_em`,
      [nome.trim(), email.trim(), cargo?.trim() || 'Técnico em Regulação', perfilValido, req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ erro: 'Usuário não encontrado.' });
    }
    return res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ erro: 'Este e-mail já está em uso por outro usuário.' });
    }
    console.error('Erro ao editar usuário:', err);
    return res.status(500).json({ erro: 'Erro ao editar usuário.' });
  }
});

// PATCH /api/usuarios/:id/senha — Alterar senha do usuário
router.patch('/:id/senha', apenasAdmin, async (req, res) => {
  try {
    const { nova_senha } = req.body;
    if (!nova_senha || nova_senha.length < 4) {
      return res.status(400).json({ erro: 'A nova senha deve ter pelo menos 4 caracteres.' });
    }

    const senhaHash = await bcrypt.hash(nova_senha, 10);
    const { rowCount } = await db.query(
      'UPDATE usuarios SET senha_hash = $1 WHERE id = $2',
      [senhaHash, req.params.id]
    );

    if (rowCount === 0) {
      return res.status(404).json({ erro: 'Usuário não encontrado.' });
    }
    return res.json({ mensagem: 'Senha alterada com sucesso.' });
  } catch (err) {
    console.error('Erro ao alterar senha:', err);
    return res.status(500).json({ erro: 'Erro ao redefinir senha.' });
  }
});

// PATCH /api/usuarios/:id/status — Ativar ou desativar acesso
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

// DELETE /api/usuarios/:id — Excluir usuário autorizado
router.delete('/:id', apenasAdmin, async (req, res) => {
  try {
    if (req.params.id === req.usuario.id) {
      return res.status(400).json({ erro: 'Você não pode excluir o próprio usuário conectado.' });
    }

    const { rowCount } = await db.query('DELETE FROM usuarios WHERE id = $1', [req.params.id]);
    if (rowCount === 0) {
      return res.status(404).json({ erro: 'Usuário não encontrado.' });
    }

    return res.json({ mensagem: 'Usuário excluído com sucesso.' });
  } catch (err) {
    console.error('Erro ao excluir usuário:', err);
    return res.status(500).json({ erro: 'Erro ao excluir usuário.' });
  }
});

module.exports = router;