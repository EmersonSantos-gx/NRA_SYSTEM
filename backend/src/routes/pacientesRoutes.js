const express = require('express');
const db = require('../config/db');
const { autenticar } = require('../middlewares/authMiddleware');

const router = express.Router();
router.use(autenticar);

// Validação matemática do CNS (Módulo 11)
function validarCNS(valor) {
  const cns = String(valor || '').replace(/\D/g, '');
  if (cns.length !== 15) return false;
  const inicio = cns[0];

  if (inicio === '1' || inicio === '2') {
    const pis = cns.substring(0, 11);
    let soma = 0;
    for (let i = 0; i < 11; i++) soma += parseInt(pis[i], 10) * (15 - i);
    let resto = soma % 11;
    let dv = 11 - resto;
    if (dv === 11) dv = 0;
    const resultado =
      dv === 10
        ? `${pis}001${11 - ((soma + 2) % 11)}`
        : `${pis}000${dv}`;
    return resultado === cns;
  }

  if (inicio === '7' || inicio === '8' || inicio === '9') {
    let soma = 0;
    for (let i = 0; i < 15; i++) soma += parseInt(cns[i], 10) * (15 - i);
    return soma % 11 === 0;
  }

  return false;
}

// Validação matemática do CPF (11 dígitos)
function validarCPF(valor) {
  const cpf = String(valor || '').replace(/\D/g, '');
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

  let soma = 0;
  for (let i = 0; i < 9; i++) soma += parseInt(cpf[i], 10) * (10 - i);
  let resto = (soma * 10) % 11;
  if (resto === 10) resto = 0;
  if (resto !== parseInt(cpf[9], 10)) return false;

  soma = 0;
  for (let i = 0; i < 10; i++) soma += parseInt(cpf[i], 10) * (11 - i);
  resto = (soma * 10) % 11;
  if (resto === 10) resto = 0;
  return resto === parseInt(cpf[10], 10);
}

function isMenorDeIdade(dataNascimento) {
  const nasc = new Date(`${dataNascimento}T00:00:00`);
  const hoje = new Date();
  let idade = hoje.getFullYear() - nasc.getFullYear();
  const m = hoje.getMonth() - nasc.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade--;
  return idade < 18;
}

// GET /api/acompanhamentos — Lista fila completa (retornando CNS e CPF)
router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT
        a.id, a.status, a.prioridade, a.motivo_pendencia, a.motivo_falta,
        a.total_faltas, a.aviso_confirmado,
        TO_CHAR(a.data_agendamento, 'YYYY-MM-DD') AS data_agendamento,
        a.hora_agendamento, a.local_agendamento, a.observacoes,
        a.criado_em, a.atualizado_em,
        p.id AS paciente_id, TRIM(p.cns) AS cns, TRIM(p.cpf) AS cpf,
        p.nome_completo AS nome_paciente,
        p.nome_mae, p.nome_responsavel,
        TO_CHAR(p.data_nascimento, 'YYYY-MM-DD') AS data_nascimento,
        p.telefone,
        pr.id AS procedimento_id, pr.nome AS procedimento_nome,
        pr.codigo_sigtap, pr.especialidade,
        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'id', h.id,
                'statusAnterior', h.status_anterior,
                'statusNovo', h.status_novo,
                'usuarioNome', h.usuario_nome,
                'observacao', h.observacao,
                'dataHora', h.data_hora
              ) ORDER BY h.data_hora DESC
            )
            FROM historico_auditoria h
            WHERE h.acompanhamento_id = a.id
          ),
          '[]'::json
        ) AS historico
      FROM acompanhamentos a
      JOIN pacientes p ON p.id = a.paciente_id
      JOIN procedimentos pr ON pr.id = a.procedimento_id
      ORDER BY a.criado_em DESC
    `);

    return res.json(rows);
  } catch (err) {
    console.error('Erro ao listar acompanhamentos:', err);
    return res.status(500).json({ erro: 'Erro ao carregar fila de pacientes.' });
  }
});

// GET /api/acompanhamentos/documento/:doc — Busca automática por CNS (15) ou CPF (11)
router.get('/documento/:doc', async (req, res) => {
  try {
    const docLimpo = String(req.params.doc || '').replace(/\D/g, '');

    let campo = null;
    if (docLimpo.length === 15) {
      if (!validarCNS(docLimpo)) {
        return res.status(400).json({ erro: 'CNS inválido pelo algoritmo Módulo 11.' });
      }
      campo = 'cns';
    } else if (docLimpo.length === 11) {
      if (!validarCPF(docLimpo)) {
        return res.status(400).json({ erro: 'CPF inválido.' });
      }
      campo = 'cpf';
    } else {
      return res.status(400).json({ erro: 'Informe um CNS (15 dígitos) ou CPF (11 dígitos).' });
    }

    const { rows } = await db.query(
      `SELECT id, TRIM(cns) AS cns, TRIM(cpf) AS cpf, nome_completo, nome_mae, nome_responsavel,
              TO_CHAR(data_nascimento, 'YYYY-MM-DD') AS data_nascimento, telefone
       FROM pacientes WHERE ${campo} = $1`,
      [docLimpo]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        encontrado: false,
        tipo: campo.toUpperCase(),
        mensagem: `${campo.toUpperCase()} não localizado na base local.`
      });
    }

    return res.json({ encontrado: true, tipo: campo.toUpperCase(), paciente: rows[0] });
  } catch (err) {
    console.error('Erro ao consultar documento:', err);
    return res.status(500).json({ erro: 'Erro ao consultar documento.' });
  }
});

// POST /api/acompanhamentos — Aceita CNS e/ou CPF e permite substituir CPF por CNS
router.post('/', async (req, res) => {
  const client = await db.pool.connect();
  try {
    const {
      cns,
      cpf,
      remover_cpf_ao_vincular_cns = true,
      nome_paciente,
      nome_mae,
      nome_responsavel,
      data_nascimento,
      telefone,
      procedimento_id,
      prioridade,
      observacoes
    } = req.body;

    const cnsLimpo = String(cns || '').replace(/\D/g, '');
    const cpfLimpo = String(cpf || '').replace(/\D/g, '');

    if (!cnsLimpo && !cpfLimpo) {
      return res.status(400).json({ erro: 'Informe pelo menos o CNS ou o CPF do paciente.' });
    }
    if (cnsLimpo && !validarCNS(cnsLimpo)) {
      return res.status(400).json({ erro: 'CNS inválido pelo algoritmo Módulo 11.' });
    }
    if (cpfLimpo && !validarCPF(cpfLimpo)) {
      return res.status(400).json({ erro: 'CPF inválido.' });
    }
    if (!nome_paciente || !data_nascimento || !procedimento_id) {
      return res.status(400).json({ erro: 'Nome, data de nascimento e procedimento são obrigatórios.' });
    }
    if (isMenorDeIdade(data_nascimento) && !nome_responsavel?.trim()) {
      return res.status(400).json({
        erro: 'Paciente menor de 18 anos exige o Nome do Responsável Legal.'
      });
    }

    await client.query('BEGIN');

    let pacienteExistente = null;
    if (cnsLimpo) {
      const r = await client.query('SELECT id, TRIM(cns) AS cns, TRIM(cpf) AS cpf FROM pacientes WHERE cns = $1', [cnsLimpo]);
      if (r.rows.length > 0) pacienteExistente = r.rows[0];
    }
    if (!pacienteExistente && cpfLimpo) {
      const r = await client.query('SELECT id, TRIM(cns) AS cns, TRIM(cpf) AS cpf FROM pacientes WHERE cpf = $1', [cpfLimpo]);
      if (r.rows.length > 0) pacienteExistente = r.rows[0];
    }

    let pacienteId;
    let notaSubstituicao = '';
    const cpfParaGravar = cnsLimpo && remover_cpf_ao_vincular_cns ? null : (cpfLimpo || null);

    if (pacienteExistente) {
      pacienteId = pacienteExistente.id;
      const tinhaCpfSemCns = !pacienteExistente.cns && pacienteExistente.cpf && cnsLimpo;

      await client.query(
        `UPDATE pacientes
         SET cns = COALESCE($1, cns),
             cpf = CASE
               WHEN $2::boolean AND ($1 IS NOT NULL OR cns IS NOT NULL) THEN NULL
               ELSE COALESCE($3, cpf)
             END,
             nome_completo = $4,
             nome_mae = COALESCE(NULLIF($5, ''), nome_mae),
             nome_responsavel = COALESCE(NULLIF($6, ''), nome_responsavel),
             telefone = COALESCE(NULLIF($7, ''), telefone),
             atualizado_em = NOW()
         WHERE id = $8`,
        [
          cnsLimpo || null,
          Boolean(remover_cpf_ao_vincular_cns),
          cpfParaGravar,
          nome_paciente.trim(),
          nome_mae?.trim() || '',
          nome_responsavel?.trim() || '',
          telefone?.trim() || '',
          pacienteId
        ]
      );

      if (tinhaCpfSemCns && remover_cpf_ao_vincular_cns) {
        notaSubstituicao = ' CNS vinculado e CPF provisório removido do cadastro (LGPD).';
      }
    } else {
      const pacRes = await client.query(
        `INSERT INTO pacientes (cns, cpf, nome_completo, nome_mae, nome_responsavel, data_nascimento, telefone)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [
          cnsLimpo || null,
          cpfParaGravar,
          nome_paciente.trim(),
          nome_mae?.trim() || null,
          nome_responsavel?.trim() || null,
          data_nascimento,
          telefone?.trim() || null
        ]
      );
      pacienteId = pacRes.rows[0].id;
    }

    const acompRes = await client.query(
      `INSERT INTO acompanhamentos (paciente_id, procedimento_id, status, prioridade, observacoes)
       VALUES ($1, $2, 'NOVO', $3, $4)
       RETURNING id`,
      [pacienteId, procedimento_id, prioridade || 'NORMAL', observacoes?.trim() || null]
    );

    const acompanhamentoId = acompRes.rows[0].id;
    const docUsado = cnsLimpo ? 'CNS' : 'CPF provisório';

    await client.query(
      `INSERT INTO historico_auditoria
         (acompanhamento_id, usuario_id, usuario_nome, status_anterior, status_novo, observacao)
       VALUES ($1, $2, $3, NULL, 'NOVO', $4)`,
      [
        acompanhamentoId,
        req.usuario.id,
        req.usuario.nome,
        `Cadastro inicial via ${docUsado} (${prioridade || 'NORMAL'}).${notaSubstituicao}`
      ]
    );

    await client.query('COMMIT');
    return res.status(201).json({ id: acompanhamentoId, mensagem: 'Acompanhamento cadastrado com sucesso.' });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') {
      return res.status(409).json({ erro: 'Este CNS ou CPF já pertence a outro paciente cadastrado.' });
    }
    console.error('Erro ao cadastrar acompanhamento:', err);
    return res.status(500).json({ erro: 'Erro ao cadastrar acompanhamento.' });
  } finally {
    client.release();
  }
});

// PUT /api/acompanhamentos/:id — Edita cadastro e permite vincular CNS removendo o CPF
router.put('/:id', async (req, res) => {
  const client = await db.pool.connect();
  try {
    const {
      cns,
      remover_cpf = true,
      telefone,
      prioridade,
      nome_responsavel,
      observacoes
    } = req.body;

    const atualRes = await client.query(
      `SELECT a.id, a.status, a.paciente_id,
              TRIM(p.cns) AS cns_atual, TRIM(p.cpf) AS cpf_atual,
              TO_CHAR(p.data_nascimento, 'YYYY-MM-DD') AS data_nascimento
       FROM acompanhamentos a
       JOIN pacientes p ON p.id = a.paciente_id
       WHERE a.id = $1`,
      [req.params.id]
    );

    if (atualRes.rows.length === 0) {
      return res.status(404).json({ erro: 'Acompanhamento não encontrado.' });
    }

    const atual = atualRes.rows[0];
    if (isMenorDeIdade(atual.data_nascimento) && !nome_responsavel?.trim()) {
      return res.status(400).json({ erro: 'Paciente menor de 18 anos exige Responsável Legal.' });
    }

    const cnsLimpo = String(cns || '').replace(/\D/g, '');
    if (cnsLimpo && !validarCNS(cnsLimpo)) {
      return res.status(400).json({ erro: 'CNS informado é inválido pelo Módulo 11.' });
    }

    const cnsFinal = cnsLimpo || atual.cns_atual || null;
    const vaiRemoverCpf = Boolean(remover_cpf && cnsFinal && atual.cpf_atual);
    const cpfFinal = vaiRemoverCpf ? null : atual.cpf_atual;

    await client.query('BEGIN');

    await client.query(
      `UPDATE pacientes
       SET cns = $1,
           cpf = $2,
           telefone = $3,
           nome_responsavel = $4,
           atualizado_em = NOW()
       WHERE id = $5`,
      [cnsFinal, cpfFinal, telefone?.trim() || null, nome_responsavel?.trim() || null, atual.paciente_id]
    );

    await client.query(
      `UPDATE acompanhamentos
       SET prioridade = $1, observacoes = $2, atualizado_em = NOW()
       WHERE id = $3`,
      [prioridade || 'NORMAL', observacoes?.trim() || null, req.params.id]
    );

    let obsLog = 'Dados cadastrais atualizados (Auditoria LGPD).';
    if (vaiRemoverCpf) {
      obsLog = 'CNS vinculado ao cadastro e CPF removido definitivamente (LGPD).';
    } else if (cnsLimpo && cnsLimpo !== atual.cns_atual) {
      obsLog = 'CNS atualizado no cadastro do paciente.';
    }

    await client.query(
      `INSERT INTO historico_auditoria
         (acompanhamento_id, usuario_id, usuario_nome, status_anterior, status_novo, observacao)
       VALUES ($1, $2, $3, $4, $4, $5)`,
      [req.params.id, req.usuario.id, req.usuario.nome, atual.status, obsLog]
    );

    await client.query('COMMIT');
    return res.json({ mensagem: obsLog });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') {
      return res.status(409).json({ erro: 'Este CNS já está vinculado a outro paciente na base.' });
    }
    console.error('Erro ao editar paciente:', err);
    return res.status(500).json({ erro: 'Erro ao atualizar cadastro.' });
  } finally {
    client.release();
  }
});

// PATCH /api/acompanhamentos/:id/status — Muda status (NOVO, PENDENTE, MARCADO, REALIZADO, FALTOU)
router.patch('/:id/status', async (req, res) => {
  const client = await db.pool.connect();
  try {
    const {
      status_destino,
      motivo_pendencia,
      motivo_falta,
      data_agendamento,
      hora_agendamento,
      local_agendamento
    } = req.body;

    const permitidos = ['NOVO', 'PENDENTE', 'MARCADO', 'REALIZADO', 'FALTOU'];
    if (!permitidos.includes(status_destino)) {
      return res.status(400).json({ erro: 'Status de destino inválido.' });
    }

    const atualRes = await client.query(
      'SELECT id, status, total_faltas FROM acompanhamentos WHERE id = $1',
      [req.params.id]
    );
    if (atualRes.rows.length === 0) {
      return res.status(404).json({ erro: 'Registro não encontrado.' });
    }
    const atual = atualRes.rows[0];
    let observacaoLog = `Status alterado para ${status_destino}.`;

    await client.query('BEGIN');

    if (status_destino === 'NOVO') {
      observacaoLog = 'Paciente retornado para a fila inicial (Status: Novo).';
      await client.query(
        `UPDATE acompanhamentos
         SET status = 'NOVO',
             motivo_pendencia = NULL,
             data_agendamento = NULL,
             hora_agendamento = NULL,
             local_agendamento = NULL,
             aviso_confirmado = FALSE,
             atualizado_em = NOW()
         WHERE id = $1`,
        [req.params.id]
      );
    } else if (status_destino === 'PENDENTE') {
      if (!motivo_pendencia?.trim()) {
        await client.query('ROLLBACK');
        return res.status(400).json({ erro: 'Motivo da pendência é obrigatório.' });
      }
      observacaoLog = `Pendência registrada: ${motivo_pendencia.trim()}`;
      await client.query(
        `UPDATE acompanhamentos SET status = 'PENDENTE', motivo_pendencia = $1, atualizado_em = NOW() WHERE id = $2`,
        [motivo_pendencia.trim(), req.params.id]
      );
    } else if (status_destino === 'MARCADO') {
      if (!data_agendamento || !local_agendamento?.trim()) {
        await client.query('ROLLBACK');
        return res.status(400).json({ erro: 'Data e local do agendamento são obrigatórios.' });
      }
      observacaoLog = `Agendado para ${data_agendamento}${hora_agendamento ? ` às ${hora_agendamento}` : ''} — ${local_agendamento.trim()}`;
      await client.query(
        `UPDATE acompanhamentos
         SET status = 'MARCADO', data_agendamento = $1, hora_agendamento = $2,
             local_agendamento = $3, motivo_pendencia = NULL, aviso_confirmado = FALSE, atualizado_em = NOW()
         WHERE id = $4`,
        [data_agendamento, hora_agendamento || null, local_agendamento.trim(), req.params.id]
      );
    } else if (status_destino === 'REALIZADO') {
      observacaoLog = 'Comparecimento confirmado e procedimento realizado.';
      await client.query(
        `UPDATE acompanhamentos SET status = 'REALIZADO', atualizado_em = NOW() WHERE id = $1`,
        [req.params.id]
      );
    } else if (status_destino === 'FALTOU') {
      if (!motivo_falta?.trim()) {
        await client.query('ROLLBACK');
        return res.status(400).json({ erro: 'Motivo da falta é obrigatório.' });
      }
      const novasFaltas = (atual.total_faltas || 0) + 1;
      observacaoLog = `Falta registrada (${novasFaltas}ª): ${motivo_falta.trim()}`;
      await client.query(
        `UPDATE acompanhamentos SET status = 'FALTOU', motivo_falta = $1, total_faltas = $2, atualizado_em = NOW() WHERE id = $3`,
        [motivo_falta.trim(), novasFaltas, req.params.id]
      );
    }

    await client.query(
      `INSERT INTO historico_auditoria
         (acompanhamento_id, usuario_id, usuario_nome, status_anterior, status_novo, observacao)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [req.params.id, req.usuario.id, req.usuario.nome, atual.status, status_destino, observacaoLog]
    );

    await client.query('COMMIT');
    return res.json({ mensagem: 'Status atualizado com sucesso.' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erro ao atualizar status:', err);
    return res.status(500).json({ erro: 'Erro ao atualizar status.' });
  } finally {
    client.release();
  }
});

// PATCH /api/acompanhamentos/:id/aviso
router.patch('/:id/aviso', async (req, res) => {
  try {
    const { rows } = await db.query(
      `UPDATE acompanhamentos SET aviso_confirmado = NOT aviso_confirmado, atualizado_em = NOW()
       WHERE id = $1 RETURNING id, status, aviso_confirmado`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ erro: 'Registro não encontrado.' });

    const obs = rows[0].aviso_confirmado
      ? 'Aviso de comparecimento confirmado com o paciente.'
      : 'Confirmação de aviso desmarcada.';

    await db.query(
      `INSERT INTO historico_auditoria
         (acompanhamento_id, usuario_id, usuario_nome, status_anterior, status_novo, observacao)
       VALUES ($1, $2, $3, $4, $4, $5)`,
      [req.params.id, req.usuario.id, req.usuario.nome, rows[0].status, obs]
    );
    return res.json(rows[0]);
  } catch (err) {
    console.error('Erro ao alternar aviso:', err);
    return res.status(500).json({ erro: 'Erro ao atualizar confirmação de aviso.' });
  }
});

module.exports = router;