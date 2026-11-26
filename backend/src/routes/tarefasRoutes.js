const express = require('express');
const db = require('../config/db');
const { autenticar, apenasAdmin } = require('../middlewares/authMiddleware');

const router = express.Router();
router.use(autenticar);

router.get('/', async (req, res) => {
  try {
    const isAdmin = req.usuario.perfil === 'ADMIN';
    const filtroSql = isAdmin ? 't.coordenador_id = $1' : 't.colaborador_id = $1';

    const { rows } = await db.query(
      `SELECT
        t.id, t.titulo, t.descricao,
        t.coordenador_id, coord.nome AS coordenador_nome,
        t.colaborador_id, colab.nome AS colaborador_nome,
        t.prioridade,
        TO_CHAR(t.prazo, 'YYYY-MM-DD') AS prazo,
        t.status, t.parecer_colaborador,
        t.anexo_nome, t.anexo_tipo, t.anexo_base64,
        t.criado_em, t.recebido_em, t.iniciado_em, t.finalizado_em, t.concluido_em
       FROM tarefas t
       LEFT JOIN usuarios coord ON coord.id = t.coordenador_id
       LEFT JOIN usuarios colab ON colab.id = t.colaborador_id
       WHERE ${filtroSql}
       ORDER BY t.criado_em DESC`,
      [req.usuario.id]
    );

    return res.json(rows);
  } catch (err) {
    console.error('Erro ao listar tarefas:', err);
    return res.status(500).json({ erro: 'Erro ao carregar tarefas.' });
  }
});

router.post('/', apenasAdmin, async (req, res) => {
  try {
    const { titulo, descricao, colaborador_id, prioridade, prazo } = req.body;
    if (!titulo?.trim() || !colaborador_id) {
      return res.status(400).json({ erro: 'Título e colaborador são obrigatórios.' });
    }

    const { rows } = await db.query(
      `INSERT INTO tarefas
         (titulo, descricao, coordenador_id, colaborador_id, prioridade, prazo, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'ATRIBUIDA')
       RETURNING *`,
      [
        titulo.trim(),
        descricao?.trim() || null,
        req.usuario.id,
        colaborador_id,
        prioridade === 'URGENCIA' ? 'URGENCIA' : 'NORMAL',
        prazo || null
      ]
    );

    return res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Erro ao criar tarefa:', err);
    return res.status(500).json({ erro: 'Erro ao distribuir tarefa.' });
  }
});

router.patch('/:id/receber', async (req, res) => {
  try {
    const { rows } = await db.query(
      `UPDATE tarefas
       SET status = 'RECEBIDA', recebido_em = NOW()
       WHERE id = $1 AND colaborador_id = $2 AND status = 'ATRIBUIDA'
       RETURNING *`,
      [req.params.id, req.usuario.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ erro: 'Tarefa não encontrada ou já confirmada.' });
    }
    return res.json(rows[0]);
  } catch (err) {
    console.error('Erro ao confirmar recebimento:', err);
    return res.status(500).json({ erro: 'Erro ao confirmar recebimento da tarefa.' });
  }
});

router.patch('/:id/iniciar', async (req, res) => {
  try {
    const { rows } = await db.query(
      `UPDATE tarefas
       SET status = 'EM_ANDAMENTO',
           recebido_em = COALESCE(recebido_em, NOW()),
           iniciado_em = NOW()
       WHERE id = $1 AND colaborador_id = $2 AND status IN ('ATRIBUIDA', 'RECEBIDA')
       RETURNING *`,
      [req.params.id, req.usuario.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ erro: 'Tarefa não encontrada ou não pode ser iniciada.' });
    }
    return res.json(rows[0]);
  } catch (err) {
    console.error('Erro ao iniciar tarefa:', err);
    return res.status(500).json({ erro: 'Erro ao iniciar tarefa.' });
  }
});

router.patch('/:id/devolver', async (req, res) => {
  try {
    const { parecer_colaborador, anexo_nome, anexo_tipo, anexo_base64 } = req.body;
    if (!parecer_colaborador?.trim()) {
      return res.status(400).json({ erro: 'Descreva a devolutiva / resolução antes de enviar.' });
    }

    const { rows } = await db.query(
      `UPDATE tarefas
       SET status = 'DEVOLVIDA',
           parecer_colaborador = $1,
           anexo_nome = $2,
           anexo_tipo = $3,
           anexo_base64 = $4,
           recebido_em = COALESCE(recebido_em, NOW()),
           iniciado_em = COALESCE(iniciado_em, NOW()),
           finalizado_em = NOW()
       WHERE id = $5 AND colaborador_id = $6 AND status IN ('ATRIBUIDA', 'RECEBIDA', 'EM_ANDAMENTO')
       RETURNING *`,
      [
        parecer_colaborador.trim(),
        anexo_nome || null,
        anexo_tipo || null,
        anexo_base64 || null,
        req.params.id,
        req.usuario.id
      ]
    );

    if (rows.length === 0) {
      return res.status(404).json({ erro: 'Tarefa não encontrada ou sem permissão.' });
    }
    return res.json(rows[0]);
  } catch (err) {
    console.error('Erro ao devolver tarefa:', err);
    return res.status(500).json({ erro: 'Erro ao enviar devolutiva da tarefa.' });
  }
});

router.patch('/:id/concluir', apenasAdmin, async (req, res) => {
  try {
    const { rows } = await db.query(
      `UPDATE tarefas
       SET status = 'CONCLUIDA', concluido_em = NOW()
       WHERE id = $1 AND coordenador_id = $2
       RETURNING *`,
      [req.params.id, req.usuario.id]
    );
    if (rows.length === 0) return res.status(404).json({ erro: 'Tarefa não encontrada.' });
    return res.json(rows[0]);
  } catch (err) {
    console.error('Erro ao concluir tarefa:', err);
    return res.status(500).json({ erro: 'Erro ao concluir tarefa.' });
  }
});

router.patch('/:id/reabrir', apenasAdmin, async (req, res) => {
  try {
    const { motivo } = req.body;
    const { rows } = await db.query(
      `UPDATE tarefas
       SET status = 'ATRIBUIDA',
           descricao = CASE
             WHEN $1::text IS NOT NULL AND $1::text <> ''
             THEN COALESCE(descricao, '') || E'\n\n[Reaberta pela coordenação]: ' || $1::text
             ELSE descricao
           END
       WHERE id = $2 AND coordenador_id = $3
       RETURNING *`,
      [motivo?.trim() || null, req.params.id, req.usuario.id]
    );
    if (rows.length === 0) return res.status(404).json({ erro: 'Tarefa não encontrada.' });
    return res.json(rows[0]);
  } catch (err) {
    console.error('Erro ao reabrir tarefa:', err);
    return res.status(500).json({ erro: 'Erro ao reabrir tarefa.' });
  }
});

module.exports = router;
