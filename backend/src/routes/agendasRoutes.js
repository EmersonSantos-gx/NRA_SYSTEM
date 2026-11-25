const express = require('express');
const db = require('../config/db');
const { autenticar } = require('../middlewares/authMiddleware');

const router = express.Router();
router.use(autenticar);

// GET /api/agendas — Lista todas as agendas com os pacientes/slots vinculados
router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT
        ag.id,
        ag.profissional_nome,
        ag.procedimento_id,
        pr.nome AS procedimento_nome,
        pr.especialidade,
        TO_CHAR(ag.data_atendimento, 'YYYY-MM-DD') AS data_atendimento,
        ag.hora_inicio,
        ag.local_atendimento,
        ag.limite_vagas,
        ag.observacoes,
        ag.criado_em,
        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'slot_id', ap.id,
                'acompanhamento_id', a.id,
                'horario_slot', COALESCE(ap.horario_slot, ag.hora_inicio),
                'aviso_enviado', ap.aviso_enviado,
                'aviso_enviado_em', ap.aviso_enviado_em,
                'status_acompanhamento', a.status,
                'prioridade', a.prioridade,
                'nome_paciente', p.nome_completo,
                'cns', TRIM(p.cns),
                'cpf', TRIM(p.cpf),
                'data_nascimento', TO_CHAR(p.data_nascimento, 'YYYY-MM-DD'),
                'nome_responsavel', p.nome_responsavel,
                'telefone', p.telefone
              ) ORDER BY ap.criado_em ASC
            )
            FROM agenda_pacientes ap
            JOIN acompanhamentos a ON a.id = ap.acompanhamento_id
            JOIN pacientes p ON p.id = a.paciente_id
            WHERE ap.agenda_id = ag.id
          ),
          '[]'::json
        ) AS pacientes
      FROM agendas ag
      LEFT JOIN procedimentos pr ON pr.id = ag.procedimento_id
      ORDER BY ag.data_atendimento DESC, ag.hora_inicio ASC
    `);

    return res.json(rows);
  } catch (err) {
    console.error('Erro ao listar agendas:', err);
    return res.status(500).json({ erro: 'Erro ao carregar agendas.' });
  }
});

// POST /api/agendas — Cria um novo grupo/slot de agenda para um profissional
router.post('/', async (req, res) => {
  try {
    const {
      profissional_nome,
      procedimento_id,
      data_atendimento,
      hora_inicio,
      local_atendimento,
      limite_vagas,
      observacoes
    } = req.body;

    if (!profissional_nome?.trim() || !data_atendimento || !hora_inicio || !limite_vagas) {
      return res.status(400).json({
        erro: 'Profissional, data, horário e quantidade de vagas são obrigatórios.'
      });
    }

    const vagasNum = parseInt(limite_vagas, 10);
    if (Number.isNaN(vagasNum) || vagasNum < 1) {
      return res.status(400).json({ erro: 'A quantidade de vagas deve ser maior que zero.' });
    }

    const { rows } = await db.query(
      `INSERT INTO agendas
         (profissional_nome, procedimento_id, data_atendimento, hora_inicio, local_atendimento, limite_vagas, observacoes, criado_por)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        profissional_nome.trim(),
        procedimento_id || null,
        data_atendimento,
        hora_inicio,
        local_atendimento?.trim() || 'PAM Salgadinho Sede',
        vagasNum,
        observacoes?.trim() || null,
        req.usuario.id
      ]
    );

    return res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Erro ao criar agenda:', err);
    return res.status(500).json({ erro: 'Erro ao criar agenda.' });
  }
});

// POST /api/agendas/:id/pacientes — Adiciona paciente na agenda respeitando o limite de vagas
router.post('/:id/pacientes', async (req, res) => {
  const client = await db.pool.connect();
  try {
    const { acompanhamento_id, horario_slot } = req.body;
    if (!acompanhamento_id) {
      return res.status(400).json({ erro: 'Selecione um paciente para adicionar à agenda.' });
    }

    await client.query('BEGIN');

    // Trava a agenda para validar o limite de vagas com segurança
    const agRes = await client.query(
      `SELECT id, profissional_nome, TO_CHAR(data_atendimento, 'YYYY-MM-DD') AS data_atendimento,
              hora_inicio, local_atendimento, limite_vagas
       FROM agendas WHERE id = $1 FOR UPDATE`,
      [req.params.id]
    );

    if (agRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ erro: 'Agenda não encontrada.' });
    }

    const agenda = agRes.rows[0];
    const countRes = await client.query(
      'SELECT COUNT(*)::int AS ocupadas FROM agenda_pacientes WHERE agenda_id = $1',
      [agenda.id]
    );

    if (countRes.rows[0].ocupadas >= agenda.limite_vagas) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        erro: `Limite atingido: esta agenda comporta no máximo ${agenda.limite_vagas} vaga(s).`
      });
    }

    const horaFinal = horario_slot?.trim() || agenda.hora_inicio;

    await client.query(
      `INSERT INTO agenda_pacientes (agenda_id, acompanhamento_id, horario_slot)
       VALUES ($1, $2, $3)`,
      [agenda.id, acompanhamento_id, horaFinal]
    );

    // Atualiza automaticamente o paciente na fila para MARCADO
    const acompAtual = await client.query(
      'SELECT status FROM acompanhamentos WHERE id = $1',
      [acompanhamento_id]
    );

    await client.query(
      `UPDATE acompanhamentos
       SET status = 'MARCADO',
           data_agendamento = $1,
           hora_agendamento = $2,
           local_agendamento = $3,
           motivo_pendencia = NULL,
           atualizado_em = NOW()
       WHERE id = $4`,
      [agenda.data_atendimento, horaFinal, agenda.local_atendimento, acompanhamento_id]
    );

    await client.query(
      `INSERT INTO historico_auditoria
         (acompanhamento_id, usuario_id, usuario_nome, status_anterior, status_novo, observacao)
       VALUES ($1, $2, $3, $4, 'MARCADO', $5)`,
      [
        acompanhamento_id,
        req.usuario.id,
        req.usuario.nome,
        acompAtual.rows[0]?.status || 'NOVO',
        `Alocado na agenda de ${agenda.profissional_nome} (${agenda.data_atendimento} às ${horaFinal} — ${agenda.local_atendimento}).`
      ]
    );

    await client.query('COMMIT');
    return res.status(201).json({ mensagem: 'Paciente alocado na vaga da agenda com sucesso.' });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') {
      return res.status(409).json({ erro: 'Este paciente já está nesta agenda.' });
    }
    console.error('Erro ao alocar paciente na agenda:', err);
    return res.status(500).json({ erro: 'Erro ao adicionar paciente na agenda.' });
  } finally {
    client.release();
  }
});

// PATCH /api/agendas/:agendaId/pacientes/:slotId/aviso — Marca que o aviso WhatsApp foi enviado
router.patch('/:agendaId/pacientes/:slotId/aviso', async (req, res) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `UPDATE agenda_pacientes
       SET aviso_enviado = TRUE, aviso_enviado_em = NOW()
       WHERE id = $1 AND agenda_id = $2
       RETURNING id, acompanhamento_id, aviso_enviado`,
      [req.params.slotId, req.params.agendaId]
    );

    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ erro: 'Vaga não encontrada.' });
    }

    await client.query(
      `UPDATE acompanhamentos
       SET aviso_confirmado = TRUE, atualizado_em = NOW()
       WHERE id = $1`,
      [rows[0].acompanhamento_id]
    );

    await client.query(
      `INSERT INTO historico_auditoria
         (acompanhamento_id, usuario_id, usuario_nome, status_anterior, status_novo, observacao)
       VALUES ($1, $2, $3, 'MARCADO', 'MARCADO', 'Aviso individual de confirmação enviado via WhatsApp pela Agenda.')`,
      [rows[0].acompanhamento_id, req.usuario.id, req.usuario.nome]
    );

    await client.query('COMMIT');
    return res.json(rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erro ao registrar envio de aviso:', err);
    return res.status(500).json({ erro: 'Erro ao registrar envio do aviso.' });
  } finally {
    client.release();
  }
});

// DELETE /api/agendas/:agendaId/pacientes/:slotId — Libera a vaga da agenda
router.delete('/:agendaId/pacientes/:slotId', async (req, res) => {
  try {
    const { rowCount } = await db.query(
      'DELETE FROM agenda_pacientes WHERE id = $1 AND agenda_id = $2',
      [req.params.slotId, req.params.agendaId]
    );
    if (rowCount === 0) return res.status(404).json({ erro: 'Slot não encontrado.' });
    return res.json({ mensagem: 'Paciente removido da agenda e vaga liberada.' });
  } catch (err) {
    console.error('Erro ao remover paciente da agenda:', err);
    return res.status(500).json({ erro: 'Erro ao liberar vaga.' });
  }
});

// DELETE /api/agendas/:id — Exclui uma agenda
router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM agendas WHERE id = $1', [req.params.id]);
    return res.json({ mensagem: 'Agenda removida.' });
  } catch (err) {
    console.error('Erro ao excluir agenda:', err);
    return res.status(500).json({ erro: 'Erro ao excluir agenda.' });
  }
});

module.exports = router;
