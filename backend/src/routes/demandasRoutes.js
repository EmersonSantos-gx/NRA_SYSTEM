const express = require('express');
const db = require('../config/db');
const { autenticar, apenasAdmin } = require('../middlewares/authMiddleware');

const router = express.Router();
router.use(autenticar);

function gerarProtocolo() {
  const agora = new Date();
  const ano = agora.getFullYear();
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `DEM-${ano}-${rand}`;
}

// GET /api/demandas — Lista demandas conforme perfil
router.get('/', async (req, res) => {
  try {
    const isAdmin = req.usuario.perfil === 'ADMIN';
    const isSolicitante = req.usuario.perfil === 'SOLICITANTE';

    let whereSql = '(d.solicitante_id = $1 OR d.responsavel_id = $1)';
    let params = [req.usuario.id];

    if (isAdmin) {
      whereSql = '1=1';
      params = [];
    } else if (isSolicitante) {
      whereSql = 'd.solicitante_id = $1';
      params = [req.usuario.id];
    }

    const { rows } = await db.query(
      `SELECT
        d.id, d.protocolo, d.titulo, d.descricao, d.categoria, d.prioridade, d.status,
        d.acompanhamento_id,
        p.nome_completo AS paciente_nome,
        TRIM(p.cns) AS paciente_cns,
        TRIM(p.cpf) AS paciente_cpf,
        pr.nome AS procedimento_nome,
        d.solicitante_id, sol.nome AS solicitante_nome, sol.cargo AS solicitante_cargo,
        d.coordenador_id, coord.nome AS coordenador_nome,
        d.responsavel_id, resp.nome AS responsavel_nome, resp.cargo AS responsavel_cargo,
        d.parecer_coordenacao, d.parecer_responsavel, d.detalhes_marcacao,
        d.criado_em, d.recebido_coord_em, d.encaminhado_em,
        d.aguardando_marcacao_em, d.marcado_em, d.devolvido_em, d.concluido_em
       FROM demandas_fluxo d
       JOIN usuarios sol ON sol.id = d.solicitante_id
       LEFT JOIN usuarios coord ON coord.id = d.coordenador_id
       LEFT JOIN usuarios resp ON resp.id = d.responsavel_id
       LEFT JOIN acompanhamentos a ON a.id = d.acompanhamento_id
       LEFT JOIN pacientes p ON p.id = a.paciente_id
       LEFT JOIN procedimentos pr ON pr.id = a.procedimento_id
       WHERE ${whereSql}
       ORDER BY d.criado_em DESC`,
      params
    );

    return res.json(rows);
  } catch (err) {
    console.error('Erro ao listar demandas:', err);
    return res.status(500).json({ erro: 'Erro ao carregar fluxo de demandas.' });
  }
});

// POST /api/demandas — Envia demanda para recebimento da Coordenação
router.post('/', async (req, res) => {
  try {
    const {
      titulo,
      descricao,
      categoria,
      prioridade,
      acompanhamento_id
    } = req.body;

    if (!titulo?.trim()) {
      return res.status(400).json({ erro: 'Informe o título/assunto da demanda.' });
    }

    const protocolo = gerarProtocolo();
    const { rows } = await db.query(
      `INSERT INTO demandas_fluxo
         (protocolo, titulo, descricao, categoria, prioridade, acompanhamento_id, solicitante_id, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'ENVIADA_COORDENACAO')
       RETURNING *`,
      [
        protocolo,
        titulo.trim(),
        descricao?.trim() || null,
        categoria || 'REGULACAO_PACIENTE',
        prioridade === 'URGENCIA' ? 'URGENCIA' : 'NORMAL',
        acompanhamento_id || null,
        req.usuario.id
      ]
    );

    return res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Erro ao enviar demanda:', err);
    return res.status(500).json({ erro: 'Erro ao registrar envio de demanda.' });
  }
});

// PATCH /api/demandas/:id/receber-coordenacao — Coordenadora confirma recebimento
router.patch('/:id/receber-coordenacao', apenasAdmin, async (req, res) => {
  try {
    const { rows } = await db.query(
      `UPDATE demandas_fluxo
       SET status = 'RECEBIDA_COORDENACAO',
           coordenador_id = $1,
           recebido_coord_em = NOW()
       WHERE id = $2 AND status = 'ENVIADA_COORDENACAO'
       RETURNING *`,
      [req.usuario.id, req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ erro: 'Demanda não encontrada ou já recebida.' });
    }
    return res.json(rows[0]);
  } catch (err) {
    console.error('Erro ao receber demanda na coordenação:', err);
    return res.status(500).json({ erro: 'Erro ao confirmar recebimento.' });
  }
});

// PATCH /api/demandas/:id/encaminhar — Coordenadora encaminha para o colaborador responsável
router.patch('/:id/encaminhar', apenasAdmin, async (req, res) => {
  try {
    const { responsavel_id, parecer_coordenacao } = req.body;
    if (!responsavel_id) {
      return res.status(400).json({ erro: 'Selecione o colaborador responsável.' });
    }

    const { rows } = await db.query(
      `UPDATE demandas_fluxo
       SET status = 'ENCAMINHADA',
           coordenador_id = $1,
           responsavel_id = $2,
           parecer_coordenacao = $3,
           recebido_coord_em = COALESCE(recebido_coord_em, NOW()),
           encaminhado_em = NOW()
       WHERE id = $4 AND status IN ('ENVIADA_COORDENACAO', 'RECEBIDA_COORDENACAO', 'DEVOLVIDA_COORDENACAO')
       RETURNING *`,
      [req.usuario.id, responsavel_id, parecer_coordenacao?.trim() || null, req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ erro: 'Demanda não encontrada ou não pode ser encaminhada.' });
    }
    return res.json(rows[0]);
  } catch (err) {
    console.error('Erro ao encaminhar demanda:', err);
    return res.status(500).json({ erro: 'Erro ao encaminhar demanda.' });
  }
});

// PATCH /api/demandas/:id/aguardando-marcacao — Coloca demanda em Aguardando Marcação
router.patch('/:id/aguardando-marcacao', async (req, res) => {
  try {
    if (req.usuario.perfil === 'SOLICITANTE') {
      return res.status(403).json({ erro: 'Perfil solicitante apenas acompanha o fluxo.' });
    }

    const isAdmin = req.usuario.perfil === 'ADMIN';
    const condicao = isAdmin ? '1=1' : 'responsavel_id = $2';
    const params = isAdmin ? [req.params.id] : [req.params.id, req.usuario.id];

    const { rows } = await db.query(
      `UPDATE demandas_fluxo
       SET status = 'AGUARDANDO_MARCACAO',
           recebido_coord_em = COALESCE(recebido_coord_em, NOW()),
           aguardando_marcacao_em = NOW()
       WHERE id = $1 AND ${condicao}
       RETURNING *`,
      params
    );

    if (rows.length === 0) {
      return res.status(404).json({ erro: 'Demanda não encontrada ou sem permissão.' });
    }
    return res.json(rows[0]);
  } catch (err) {
    console.error('Erro ao atualizar para aguardando marcação:', err);
    return res.status(500).json({ erro: 'Erro ao atualizar status da demanda.' });
  }
});

// PATCH /api/demandas/:id/marcar — Registra a demanda como Marcada (com detalhes opcionais)
router.patch('/:id/marcar', async (req, res) => {
  try {
    if (req.usuario.perfil === 'SOLICITANTE') {
      return res.status(403).json({ erro: 'Perfil solicitante apenas acompanha o fluxo.' });
    }

    const { detalhes_marcacao } = req.body;
    const isAdmin = req.usuario.perfil === 'ADMIN';
    const condicao = isAdmin ? '1=1' : 'responsavel_id = $3';
    const params = isAdmin
      ? [detalhes_marcacao?.trim() || null, req.params.id]
      : [detalhes_marcacao?.trim() || null, req.params.id, req.usuario.id];

    const { rows } = await db.query(
      `UPDATE demandas_fluxo
       SET status = 'MARCADO',
           detalhes_marcacao = COALESCE($1, detalhes_marcacao),
           recebido_coord_em = COALESCE(recebido_coord_em, NOW()),
           aguardando_marcacao_em = COALESCE(aguardando_marcacao_em, NOW()),
           marcado_em = NOW()
       WHERE id = $2 AND ${condicao}
       RETURNING *`,
      params
    );

    if (rows.length === 0) {
      return res.status(404).json({ erro: 'Demanda não encontrada ou sem permissão.' });
    }
    return res.json(rows[0]);
  } catch (err) {
    console.error('Erro ao marcar demanda:', err);
    return res.status(500).json({ erro: 'Erro ao registrar marcação da demanda.' });
  }
});

// PATCH /api/demandas/:id/iniciar — Colaborador responsável inicia atendimento
router.patch('/:id/iniciar', async (req, res) => {
  try {
    const { rows } = await db.query(
      `UPDATE demandas_fluxo
       SET status = 'EM_EXECUCAO'
       WHERE id = $1 AND responsavel_id = $2 AND status = 'ENCAMINHADA'
       RETURNING *`,
      [req.params.id, req.usuario.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ erro: 'Demanda não encontrada ou sem permissão.' });
    }
    return res.json(rows[0]);
  } catch (err) {
    console.error('Erro ao iniciar demanda:', err);
    return res.status(500).json({ erro: 'Erro ao iniciar execução.' });
  }
});

// PATCH /api/demandas/:id/devolver — Colaborador responsável devolve resolução para a Coordenação
router.patch('/:id/devolver', async (req, res) => {
  try {
    const { parecer_responsavel } = req.body;
    if (!parecer_responsavel?.trim()) {
      return res.status(400).json({ erro: 'Informe o parecer/resolução antes de devolver.' });
    }

    const { rows } = await db.query(
      `UPDATE demandas_fluxo
       SET status = 'DEVOLVIDA_COORDENACAO',
           parecer_responsavel = $1,
           devolvido_em = NOW()
       WHERE id = $2 AND responsavel_id = $3 AND status IN ('ENCAMINHADA', 'EM_EXECUCAO', 'AGUARDANDO_MARCACAO', 'MARCADO')
       RETURNING *`,
      [parecer_responsavel.trim(), req.params.id, req.usuario.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ erro: 'Demanda não encontrada ou sem permissão.' });
    }
    return res.json(rows[0]);
  } catch (err) {
    console.error('Erro ao devolver demanda:', err);
    return res.status(500).json({ erro: 'Erro ao devolver demanda.' });
  }
});

// PATCH /api/demandas/:id/concluir — Coordenadora encerra o fluxo da demanda
router.patch('/:id/concluir', apenasAdmin, async (req, res) => {
  try {
    const { rows } = await db.query(
      `UPDATE demandas_fluxo
       SET status = 'CONCLUIDA',
           coordenador_id = COALESCE(coordenador_id, $1),
           concluido_em = NOW()
       WHERE id = $2
       RETURNING *`,
      [req.usuario.id, req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ erro: 'Demanda não encontrada.' });
    }
    return res.json(rows[0]);
  } catch (err) {
    console.error('Erro ao concluir demanda:', err);
    return res.status(500).json({ erro: 'Erro ao concluir demanda.' });
  }
});

module.exports = router;