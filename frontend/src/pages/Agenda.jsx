import { useMemo, useState } from 'react';
import {
  CalendarDays,
  Plus,
  UserPlus,
  MessageCircle,
  Trash2,
  CheckCircle2,
  Search
} from 'lucide-react';
import api from '../services/api';
import { formatarCNS, formatarCPF } from '../utils/validarCNS';
import { formatarDataBR, isMenorDeIdade } from '../utils/formatters';
import { STATUS_CONFIG, PrioridadeBadge } from '../components/common/Badges';
import WhatsAppAgendaModal from '../components/modals/WhatsAppAgendaModal';

// Máscara automática DD/MM/AAAA
function aplicarMascaraDataBR(valor) {
  const d = String(valor || '').replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

// Converte DD/MM/AAAA -> YYYY-MM-DD para o PostgreSQL (retorna null se inválida)
function converterDataBRParaISO(dataBR) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(dataBR || '').trim());
  if (!m) return null;
  const dia = parseInt(m[1], 10);
  const mes = parseInt(m[2], 10);
  const ano = parseInt(m[3], 10);
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31 || ano < 2000 || ano > 2100) return null;
  const dt = new Date(ano, mes - 1, dia);
  if (dt.getFullYear() !== ano || dt.getMonth() !== mes - 1 || dt.getDate() !== dia) return null;
  return `${String(ano).padStart(4, '0')}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

// Máscara automática 24h HH:MM
function aplicarMascaraHora24(valor) {
  const d = String(valor || '').replace(/\D/g, '').slice(0, 4);
  if (d.length <= 2) return d;
  return `${d.slice(0, 2)}:${d.slice(2)}`;
}

// Valida formato 24h (00:00 até 23:59)
function validarHora24(hora) {
  const m = /^(\d{2}):(\d{2})$/.exec(String(hora || '').trim());
  if (!m) return false;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  return h >= 0 && h <= 23 && min >= 0 && min <= 59;
}

export default function Agenda({
  agendas,
  procedimentos,
  acompanhamentos,
  usuarioLogado,
  onRecarregar,
  onNotificar
}) {
  const [profissionalNome, setProfissionalNome] = useState('');
  const [procedimentoId, setProcedimentoId] = useState(procedimentos[0]?.id || '');
  const [dataAtendimentoBR, setDataAtendimentoBR] = useState('');
  const [horaInicio, setHoraInicio] = useState('08:00');
  const [localAtendimento, setLocalAtendimento] = useState('PAM Salgadinho Sede');
  const [limiteVagas, setLimiteVagas] = useState(10);

  const [agendaSelecionadaId, setAgendaSelecionadaId] = useState(agendas[0]?.id || null);
  const [buscaPaciente, setBuscaPaciente] = useState('');
  const [horarioSlot, setHorarioSlot] = useState('');
  const [modalWhatsApp, setModalWhatsApp] = useState(null); // { agenda, slot }

  const agendaAtiva = useMemo(
    () => agendas.find((a) => a.id === agendaSelecionadaId) || agendas[0] || null,
    [agendas, agendaSelecionadaId]
  );

  // Pacientes disponíveis para compor a agenda (ainda não estão nesta agenda e não realizados)
  const pacientesDisponiveis = useMemo(() => {
    if (!agendaAtiva) return [];
    const idsNaAgenda = new Set((agendaAtiva.pacientes || []).map((p) => p.acompanhamento_id));
    const termo = buscaPaciente.trim().toLowerCase();

    return acompanhamentos.filter((a) => {
      if (idsNaAgenda.has(a.id)) return false;
      if (a.status === 'REALIZADO') return false;
      if (!termo) return true;
      return (
        (a.nome_paciente || '').toLowerCase().includes(termo) ||
        String(a.cns || '').includes(termo) ||
        String(a.cpf || '').includes(termo) ||
        (a.procedimento_nome || '').toLowerCase().includes(termo)
      );
    });
  }, [acompanhamentos, agendaAtiva, buscaPaciente]);

  async function handleCriarAgenda(e) {
    e.preventDefault();
    const dataISO = converterDataBRParaISO(dataAtendimentoBR);
    if (!dataISO) {
      onNotificar('Informe uma data válida no formato DD/MM/AAAA.', 'erro');
      return;
    }
    if (!validarHora24(horaInicio)) {
      onNotificar('Informe um horário válido no padrão 24h (ex: 08:00 ou 14:30).', 'erro');
      return;
    }

    try {
      const { data } = await api.post('/agendas', {
        profissional_nome: profissionalNome.trim(),
        procedimento_id: procedimentoId || null,
        data_atendimento: dataISO,
        hora_inicio: horaInicio,
        local_atendimento: localAtendimento.trim(),
        limite_vagas: Number(limiteVagas)
      });
      setProfissionalNome('');
      setDataAtendimentoBR('');
      setAgendaSelecionadaId(data.id);
      await onRecarregar();
      onNotificar(`Agenda criada com limite de ${limiteVagas} vaga(s).`);
    } catch (err) {
      onNotificar(err.response?.data?.erro || 'Erro ao criar agenda.', 'erro');
    }
  }

  async function handleAlocarPaciente(acompanhamentoId) {
    if (!agendaAtiva) return;
    const horaAlvo = horarioSlot || agendaAtiva.hora_inicio;
    if (!validarHora24(horaAlvo)) {
      onNotificar('Informe um horário individual válido no padrão 24h (HH:MM).', 'erro');
      return;
    }

    try {
      await api.post(`/agendas/${agendaAtiva.id}/pacientes`, {
        acompanhamento_id: acompanhamentoId,
        horario_slot: horaAlvo
      });
      await onRecarregar();
      onNotificar('Paciente adicionado à agenda e marcado na fila.');
    } catch (err) {
      onNotificar(err.response?.data?.erro || 'Erro ao adicionar paciente.', 'erro');
    }
  }

  async function handleRemoverSlot(slotId) {
    if (!agendaAtiva) return;
    try {
      await api.delete(`/agendas/${agendaAtiva.id}/pacientes/${slotId}`);
      await onRecarregar();
      onNotificar('Vaga liberada na agenda.');
    } catch {
      onNotificar('Erro ao liberar vaga.', 'erro');
    }
  }

  async function handleMarcarAvisoEnviado(agendaId, slotId) {
    try {
      await api.patch(`/agendas/${agendaId}/pacientes/${slotId}/aviso`);
      await onRecarregar();
      onNotificar('Aviso via WhatsApp registrado.');
    } catch {
      onNotificar('Erro ao registrar aviso.', 'erro');
    }
  }

  async function handleExcluirAgenda(id) {
    try {
      await api.delete(`/agendas/${id}`);
      await onRecarregar();
      onNotificar('Agenda excluída.');
    } catch {
      onNotificar('Erro ao excluir agenda.', 'erro');
    }
  }

  const ocupadas = agendaAtiva?.pacientes?.length || 0;
  const lotada = agendaAtiva ? ocupadas >= agendaAtiva.limite_vagas : false;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight">
          Agenda por Profissional (Slots de Vagas)
        </h2>
        <p className="text-sm text-slate-400 mt-0.5">
          Crie grupos de atendimento (data DD/MM/AAAA e horário 24h), selecione os pacientes e envie o aviso individual via WhatsApp.
        </p>
      </div>

      {/* Formulário: Criar Novo Grupo / Slot de Agenda */}
      <form
        onSubmit={handleCriarAgenda}
        className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3.5 items-end shadow-xl"
      >
        <div className="lg:col-span-2">
          <label className="block text-xs text-slate-300 mb-1">Profissional *</label>
          <input
            type="text"
            required
            value={profissionalNome}
            onChange={(e) => setProfissionalNome(e.target.value)}
            placeholder="Ex: Dra. Maria Clara (Cardiologia)"
            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs sm:text-sm text-white"
          />
        </div>

        <div>
          <label className="block text-xs text-slate-300 mb-1">Procedimento</label>
          <select
            value={procedimentoId}
            onChange={(e) => setProcedimentoId(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs sm:text-sm text-white"
          >
            <option value="">Geral</option>
            {procedimentos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-slate-300 mb-1">Data (DD/MM/AAAA) *</label>
          <input
            type="text"
            inputMode="numeric"
            required
            maxLength={10}
            value={dataAtendimentoBR}
            onChange={(e) => setDataAtendimentoBR(aplicarMascaraDataBR(e.target.value))}
            placeholder="DD/MM/AAAA"
            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs sm:text-sm font-mono text-white"
          />
        </div>

        <div>
          <label className="block text-xs text-slate-300 mb-1">Horário 24h (HH:MM) *</label>
          <input
            type="text"
            inputMode="numeric"
            required
            maxLength={5}
            value={horaInicio}
            onChange={(e) => setHoraInicio(aplicarMascaraHora24(e.target.value))}
            placeholder="08:00"
            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs sm:text-sm font-mono text-white"
          />
        </div>

        <div>
          <label className="block text-xs text-slate-300 mb-1">Limite de Vagas *</label>
          <input
            type="number"
            min={1}
            max={200}
            required
            value={limiteVagas}
            onChange={(e) => setLimiteVagas(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs sm:text-sm text-white"
          />
        </div>

        <div className="sm:col-span-2 lg:col-span-4">
          <label className="block text-xs text-slate-300 mb-1">Local de Atendimento</label>
          <input
            type="text"
            value={localAtendimento}
            onChange={(e) => setLocalAtendimento(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs sm:text-sm text-white"
          />
        </div>

        <div className="sm:col-span-2 lg:col-span-2">
          <button
            type="submit"
            className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#085041] to-[#1D9E75] text-white text-xs font-semibold cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Criar Grupo de Agenda
          </button>
        </div>
      </form>

      {/* Layout em 2 colunas: Lista de Agendas + Gestão de Slots da Agenda Ativa */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Lista de Agendas */}
        <div className="lg:col-span-4 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Agendas Criadas ({agendas.length})
          </h3>

          {agendas.length === 0 ? (
            <div className="p-6 rounded-2xl bg-slate-900/60 border border-dashed border-slate-800 text-xs text-slate-500 text-center">
              Nenhuma agenda criada ainda. Use o formulário acima.
            </div>
          ) : (
            agendas.map((ag) => {
              const qtd = ag.pacientes?.length || 0;
              const pct = Math.min((qtd / ag.limite_vagas) * 100, 100);
              const selecionada = agendaAtiva?.id === ag.id;

              return (
                <div
                  key={ag.id}
                  onClick={() => {
                    setAgendaSelecionadaId(ag.id);
                    setHorarioSlot(ag.hora_inicio);
                  }}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer space-y-2.5 ${
                    selecionada
                      ? 'bg-[#085041]/25 border-[#1D9E75]/60 shadow-lg'
                      : 'bg-slate-900/75 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-white truncate">
                        {ag.profissional_nome}
                      </p>
                      <p className="text-[11px] text-slate-400 truncate">
                        {ag.procedimento_nome || 'Atendimento Geral'}
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleExcluirAgenda(ag.id);
                      }}
                      title="Excluir agenda"
                      className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-300">
                    <span className="flex items-center gap-1">
                      <CalendarDays className="w-3.5 h-3.5 text-[#1D9E75]" />
                      {formatarDataBR(ag.data_atendimento)} • {ag.hora_inicio}h
                    </span>
                    <span
                      className={`font-bold ${
                        qtd >= ag.limite_vagas ? 'text-rose-300' : 'text-emerald-300'
                      }`}
                    >
                      {qtd} / {ag.limite_vagas} vagas
                    </span>
                  </div>

                  <div className="w-full h-1.5 rounded-full bg-slate-950 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        qtd >= ag.limite_vagas ? 'bg-rose-400' : 'bg-[#1D9E75]'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Detalhe dos Slots e Seleção de Pacientes */}
        <div className="lg:col-span-8 space-y-5">
          {!agendaAtiva ? (
            <div className="p-10 rounded-2xl bg-slate-900/60 border border-slate-800 text-center text-sm text-slate-500">
              Selecione ou crie uma agenda ao lado para gerenciar as vagas.
            </div>
          ) : (
            <>
              {/* Pacientes já alocados nos Slots */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                <div className="px-5 py-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 bg-slate-950/60">
                  <div>
                    <h3 className="text-base font-bold text-white">
                      {agendaAtiva.profissional_nome}
                    </h3>
                    <p className="text-xs text-slate-400">
                      {formatarDataBR(agendaAtiva.data_atendimento)} às {agendaAtiva.hora_inicio}h —{' '}
                      {agendaAtiva.local_atendimento}
                    </p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold border ${
                      lotada
                        ? 'bg-rose-500/15 text-rose-300 border-rose-500/40'
                        : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                    }`}
                  >
                    {ocupadas} / {agendaAtiva.limite_vagas} vagas ocupadas{' '}
                    {lotada ? '(LOTADA)' : ''}
                  </span>
                </div>

                {ocupadas === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500">
                    Nenhum paciente alocado ainda. Selecione pacientes abaixo para compor esta agenda.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-800/70">
                    {agendaAtiva.pacientes.map((slot, idx) => {
                      const menor = isMenorDeIdade(slot.data_nascimento);
                      return (
                        <div
                          key={slot.slot_id}
                          className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-800/40"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                                Vaga #{idx + 1} • {slot.horario_slot}h
                              </span>
                              <span className="text-sm font-semibold text-white">
                                {slot.nome_paciente}
                              </span>
                              <PrioridadeBadge prioridade={slot.prioridade} />
                              {menor && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#C8963C]/20 text-[#f0cc82] border border-[#C8963C]/40">
                                  Menor
                                </span>
                              )}
                              {slot.aviso_enviado && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/40">
                                  <CheckCircle2 className="w-3 h-3" /> Avisado
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] font-mono text-slate-400">
                              {slot.cns
                                ? `CNS: ${formatarCNS(slot.cns)}`
                                : `CPF: ${formatarCPF(slot.cpf)}`}{' '}
                              - Tel: {slot.telefone || '—'}
                              {menor && slot.nome_responsavel
                                ? ` • Resp.: ${slot.nome_responsavel}`
                                : ''}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() =>
                                setModalWhatsApp({ agenda: agendaAtiva, slot })
                              }
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold cursor-pointer"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                              Avisar WhatsApp
                            </button>
                            <button
                              onClick={() => handleRemoverSlot(slot.slot_id)}
                              title="Liberar vaga"
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Selecionar Pacientes da Fila para compor a Agenda */}
              <div className="bg-slate-900/75 border border-slate-800 rounded-2xl p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <UserPlus className="w-4 h-4 text-[#1D9E75]" />
                    Adicionar Pacientes nesta Agenda
                  </h4>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-400">Horário 24h (HH:MM):</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={5}
                      value={horarioSlot || agendaAtiva.hora_inicio}
                      onChange={(e) => setHorarioSlot(aplicarMascaraHora24(e.target.value))}
                      placeholder="08:00"
                      className="w-20 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono text-center text-white"
                    />
                  </div>
                </div>

                {lotada ? (
                  <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/35 text-xs text-rose-200">
                    Todas as {agendaAtiva.limite_vagas} vagas desta agenda estão preenchidas. Libere uma vaga ou crie uma nova agenda.
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={buscaPaciente}
                        onChange={(e) => setBuscaPaciente(e.target.value)}
                        placeholder="Filtrar paciente por nome, CNS, CPF ou procedimento..."
                        className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                      />
                    </div>

                    <div className="max-h-60 overflow-y-auto divide-y divide-slate-800/70 border border-slate-800 rounded-xl bg-slate-950/60">
                      {pacientesDisponiveis.length === 0 ? (
                        <p className="p-5 text-center text-xs text-slate-500">
                          Nenhum paciente disponível na fila para adicionar.
                        </p>
                      ) : (
                        pacientesDisponiveis.map((p) => (
                          <div
                            key={p.id}
                            className="p-3 flex items-center justify-between gap-3 hover:bg-slate-800/40"
                          >
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-white truncate">
                                {p.nome_paciente}{' '}
                                <span className="text-[10px] text-slate-400 font-normal">
                                  ({STATUS_CONFIG[p.status]?.label})
                                </span>
                              </p>
                              <p className="text-[11px] text-slate-400 truncate">
                                {p.procedimento_nome} •{' '}
                                {p.cns ? `CNS ${formatarCNS(p.cns)}` : `CPF ${formatarCPF(p.cpf)}`}
                              </p>
                            </div>
                            <button
                              onClick={() => handleAlocarPaciente(p.id)}
                              className="px-3 py-1.5 rounded-lg bg-[#085041] hover:bg-[#1D9E75] text-white text-xs font-semibold shrink-0 cursor-pointer"
                            >
                              + Alocar Vaga
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {modalWhatsApp && (
        <WhatsAppAgendaModal
          agenda={modalWhatsApp.agenda}
          slot={modalWhatsApp.slot}
          usuarioLogado={usuarioLogado}
          onFechar={() => setModalWhatsApp(null)}
          onMarcarEnviado={() =>
            handleMarcarAvisoEnviado(modalWhatsApp.agenda.id, modalWhatsApp.slot.slot_id)
          }
        />
      )}
    </div>
  );
}