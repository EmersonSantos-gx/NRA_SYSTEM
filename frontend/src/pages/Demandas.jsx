import { useMemo, useState } from 'react';
import {
  GitPullRequestArrow,
  Send,
  Inbox,
  UserCheck,
  CheckCircle2,
  Play,
  RotateCcw,
  User,
  Clock
} from 'lucide-react';
import api from '../services/api';
import { formatarCNS, formatarCPF } from '../utils/validarCNS';
import { formatarDataHoraBR } from '../utils/formatters';
import { STATUS_CONFIG, PrioridadeBadge } from '../components/common/Badges';

const STATUS_DEMANDA_CFG = {
  ENVIADA_COORDENACAO: {
    label: 'Aguardando Recebimento (Coordenação)',
    bg: 'bg-amber-500/15',
    text: 'text-amber-300',
    border: 'border-amber-400/40'
  },
  RECEBIDA_COORDENACAO: {
    label: 'Recebida pela Coordenação',
    bg: 'bg-sky-500/15',
    text: 'text-sky-300',
    border: 'border-sky-400/40'
  },
  ENCAMINHADA: {
    label: 'Encaminhada ao Responsável',
    bg: 'bg-indigo-500/15',
    text: 'text-indigo-200',
    border: 'border-indigo-400/40'
  },
  EM_EXECUCAO: {
    label: 'Em Execução pelo Responsável',
    bg: 'bg-purple-500/15',
    text: 'text-purple-200',
    border: 'border-purple-400/40'
  },
  DEVOLVIDA_COORDENACAO: {
    label: 'Devolvida à Coordenação',
    bg: 'bg-[#C8963C]/20',
    text: 'text-[#f0cc82]',
    border: 'border-[#C8963C]/45'
  },
  CONCLUIDA: {
    label: 'Concluída',
    bg: 'bg-emerald-500/15',
    text: 'text-emerald-300',
    border: 'border-emerald-400/40'
  }
};

const CATEGORIAS = [
  { valor: 'REGULACAO_PACIENTE', label: 'Paciente Cadastrado / Regulação' },
  { valor: 'PRIORIZACAO_CLINICA', label: 'Solicitação de Priorização / Urgência' },
  { valor: 'PENDENCIA_DOCUMENTAL', label: 'Pendência de Documento / Laudo' },
  { valor: 'REMANEJAMENTO_VAGA', label: 'Remanejamento de Vaga / Agenda' },
  { valor: 'OUTRA_DEMANDA', label: 'Outras Demandas Administrativas' }
];

export default function Demandas({
  demandas,
  usuarios,
  acompanhamentos,
  usuarioLogado,
  onRecarregar,
  onVerPaciente,
  onNotificar
}) {
  const isCoordenador = usuarioLogado?.perfil === 'ADMIN';

  // Formulário de abertura/envio de demanda para a Coordenação
  const [titulo, setTitulo] = useState('');
  const [categoria, setCategoria] = useState('REGULACAO_PACIENTE');
  const [prioridade, setPrioridade] = useState('NORMAL');
  const [acompanhamentoId, setAcompanhamentoId] = useState('');
  const [descricao, setDescricao] = useState('');
  const [enviando, setEnviando] = useState(false);

  // Filtros de visualização
  const [filtroAba, setFiltroAba] = useState(isCoordenador ? 'TRIAGEM' : 'MINHAS_RECEBIDAS');

  // Estados de encaminhamento pela Coordenadora
  const [encaminhandoId, setEncaminhandoId] = useState(null);
  const [responsavelId, setResponsavelId] = useState('');
  const [parecerCoord, setParecerCoord] = useState('');

  // Estados de devolutiva pelo Colaborador Responsável
  const [devolvendoId, setDevolvendoId] = useState(null);
  const [parecerResp, setParecerResp] = useState('');

  const colaboradoresAtivos = useMemo(
    () => usuarios.filter((u) => u.ativo),
    [usuarios]
  );

  const contadores = useMemo(() => {
    return {
      TRIAGEM: demandas.filter((d) =>
        ['ENVIADA_COORDENACAO', 'RECEBIDA_COORDENACAO'].includes(d.status)
      ).length,
      EM_FLUXO: demandas.filter((d) =>
        ['ENCAMINHADA', 'EM_EXECUCAO', 'DEVOLVIDA_COORDENACAO'].includes(d.status)
      ).length,
      MINHAS_RECEBIDAS: demandas.filter(
        (d) =>
          d.responsavel_id === usuarioLogado.id &&
          ['ENCAMINHADA', 'EM_EXECUCAO'].includes(d.status)
      ).length,
      MINHAS_ENVIADAS: demandas.filter((d) => d.solicitante_id === usuarioLogado.id).length,
      CONCLUIDAS: demandas.filter((d) => d.status === 'CONCLUIDA').length
    };
  }, [demandas, usuarioLogado.id]);

  const listaFiltrada = useMemo(() => {
    if (filtroAba === 'TRIAGEM') {
      return demandas.filter((d) =>
        ['ENVIADA_COORDENACAO', 'RECEBIDA_COORDENACAO'].includes(d.status)
      );
    }
    if (filtroAba === 'EM_FLUXO') {
      return demandas.filter((d) =>
        ['ENCAMINHADA', 'EM_EXECUCAO', 'DEVOLVIDA_COORDENACAO'].includes(d.status)
      );
    }
    if (filtroAba === 'MINHAS_RECEBIDAS') {
      return demandas.filter(
        (d) =>
          d.responsavel_id === usuarioLogado.id &&
          ['ENCAMINHADA', 'EM_EXECUCAO'].includes(d.status)
      );
    }
    if (filtroAba === 'MINHAS_ENVIADAS') {
      return demandas.filter((d) => d.solicitante_id === usuarioLogado.id);
    }
    return demandas.filter((d) => d.status === 'CONCLUIDA');
  }, [demandas, filtroAba, usuarioLogado.id]);

  async function handleEnviarDemanda(e) {
    e.preventDefault();
    if (!titulo.trim()) return;
    setEnviando(true);
    try {
      await api.post('/demandas', {
        titulo: titulo.trim(),
        categoria,
        prioridade,
        acompanhamento_id: acompanhamentoId || null,
        descricao: descricao.trim()
      });
      setTitulo('');
      setDescricao('');
      setAcompanhamentoId('');
      setPrioridade('NORMAL');
      if (!isCoordenador) setFiltroAba('MINHAS_ENVIADAS');
      await onRecarregar();
      onNotificar('Demanda enviada para recebimento da Coordenação.');
    } catch (err) {
      onNotificar(err.response?.data?.erro || 'Erro ao enviar demanda.', 'erro');
    } finally {
      setEnviando(false);
    }
  }

  async function handleReceberCoordenacao(id) {
    try {
      await api.patch(`/demandas/${id}/receber-coordenacao`);
      await onRecarregar();
      onNotificar('Recebimento confirmado pela Coordenação.');
    } catch (err) {
      onNotificar(err.response?.data?.erro || 'Erro ao confirmar recebimento.', 'erro');
    }
  }

  async function handleEncaminhar(id) {
    const alvo = responsavelId || colaboradoresAtivos[0]?.id;
    if (!alvo) {
      onNotificar('Selecione o colaborador responsável.', 'erro');
      return;
    }
    try {
      await api.patch(`/demandas/${id}/encaminhar`, {
        responsavel_id: alvo,
        parecer_coordenacao: parecerCoord
      });
      setEncaminhandoId(null);
      setParecerCoord('');
      await onRecarregar();
      onNotificar('Demanda encaminhada ao colaborador responsável.');
    } catch (err) {
      onNotificar(err.response?.data?.erro || 'Erro ao encaminhar demanda.', 'erro');
    }
  }

  async function handleIniciarExecucao(id) {
    try {
      await api.patch(`/demandas/${id}/iniciar`);
      await onRecarregar();
      onNotificar('Execução da demanda iniciada.');
    } catch (err) {
      onNotificar(err.response?.data?.erro || 'Erro ao iniciar demanda.', 'erro');
    }
  }

  async function handleDevolverCoordenacao(id) {
    if (!parecerResp.trim()) return;
    try {
      await api.patch(`/demandas/${id}/devolver`, {
        parecer_responsavel: parecerResp.trim()
      });
      setDevolvendoId(null);
      setParecerResp('');
      await onRecarregar();
      onNotificar('Resolução devolvida para a Coordenação.');
    } catch (err) {
      onNotificar(err.response?.data?.erro || 'Erro ao devolver demanda.', 'erro');
    }
  }

  async function handleConcluir(id) {
    try {
      await api.patch(`/demandas/${id}/concluir`);
      await onRecarregar();
      onNotificar('Demanda concluída e encerrada.');
    } catch (err) {
      onNotificar(err.response?.data?.erro || 'Erro ao concluir demanda.', 'erro');
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
          <GitPullRequestArrow className="w-6 h-6 text-[#1D9E75]" />
          Fluxo de Envio e Encaminhamento de Demandas
        </h2>
        <p className="text-sm text-slate-400 mt-0.5">
          Envie pacientes recém-cadastrados ou solicitações para recebimento da Coordenação e direcionamento ao colaborador responsável.
        </p>
      </div>

      {/* Formulário: Registrar e Enviar Nova Demanda para a Coordenação */}
      <form
        onSubmit={handleEnviarDemanda}
        className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl"
      >
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-300">
          <Send className="w-3.5 h-3.5" />
          Novo Envio para Recebimento da Coordenação
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div className="md:col-span-2">
            <label className="block text-xs text-slate-300 mb-1">Assunto / Demanda *</label>
            <input
              type="text"
              required
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex: Paciente cadastrado aguardando direcionamento para Cardiologia"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-300 mb-1">Tipo de Demanda</label>
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white"
            >
              {CATEGORIAS.map((c) => (
                <option key={c.valor} value={c.valor}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-slate-300 mb-1">Prioridade</label>
            <select
              value={prioridade}
              onChange={(e) => setPrioridade(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white"
            >
              <option value="NORMAL">Normal</option>
              <option value="URGENCIA">Urgência</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs text-slate-300 mb-1">
              Vincular Paciente Cadastrado (opcional)
            </label>
            <select
              value={acompanhamentoId}
              onChange={(e) => setAcompanhamentoId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white"
            >
              <option value="">Sem vínculo específico / Demanda geral</option>
              {acompanhamentos.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nome_paciente} — {a.procedimento_nome} ({STATUS_CONFIG[a.status]?.label})
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2 flex flex-col justify-end">
            <label className="block text-xs text-slate-300 mb-1">Observações / Detalhes</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Informe detalhes para a Coordenadora..."
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white"
              />
              <button
                type="submit"
                disabled={enviando}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#085041] to-[#1D9E75] text-white text-xs font-semibold shrink-0 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                {enviando ? 'Enviando...' : 'Enviar'}
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* Abas de Filtro */}
      <div className="flex items-center gap-2 flex-wrap">
        {isCoordenador ? (
          <>
            <button
              onClick={() => setFiltroAba('TRIAGEM')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold border cursor-pointer ${
                filtroAba === 'TRIAGEM'
                  ? 'bg-amber-500/20 text-amber-200 border-amber-400/50'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
              }`}
            >
              Caixa de Entrada / Recebimento ({contadores.TRIAGEM})
            </button>
            <button
              onClick={() => setFiltroAba('EM_FLUXO')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold border cursor-pointer ${
                filtroAba === 'EM_FLUXO'
                  ? 'bg-indigo-500/20 text-indigo-200 border-indigo-400/50'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
              }`}
            >
              Encaminhadas / Em Execução ({contadores.EM_FLUXO})
            </button>
            <button
              onClick={() => setFiltroAba('CONCLUIDAS')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold border cursor-pointer ${
                filtroAba === 'CONCLUIDAS'
                  ? 'bg-emerald-500/20 text-emerald-200 border-emerald-400/50'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
              }`}
            >
              Concluídas ({contadores.CONCLUIDAS})
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => setFiltroAba('MINHAS_RECEBIDAS')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold border cursor-pointer ${
                filtroAba === 'MINHAS_RECEBIDAS'
                  ? 'bg-indigo-500/20 text-indigo-200 border-indigo-400/50'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
              }`}
            >
              Encaminhadas para Mim ({contadores.MINHAS_RECEBIDAS})
            </button>
            <button
              onClick={() => setFiltroAba('MINHAS_ENVIADAS')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold border cursor-pointer ${
                filtroAba === 'MINHAS_ENVIADAS'
                  ? 'bg-amber-500/20 text-amber-200 border-amber-400/50'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
              }`}
            >
              Enviadas por Mim ({contadores.MINHAS_ENVIADAS})
            </button>
            <button
              onClick={() => setFiltroAba('CONCLUIDAS')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold border cursor-pointer ${
                filtroAba === 'CONCLUIDAS'
                  ? 'bg-emerald-500/20 text-emerald-200 border-emerald-400/50'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
              }`}
            >
              Concluídas ({contadores.CONCLUIDAS})
            </button>
          </>
        )}
      </div>

      {/* Lista de Demandas */}
      {listaFiltrada.length === 0 ? (
        <div className="bg-slate-900/60 border border-dashed border-slate-800 rounded-2xl p-10 text-center text-sm text-slate-500">
          Nenhuma demanda nesta fila no momento.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {listaFiltrada.map((d) => {
            const st = STATUS_DEMANDA_CFG[d.status] || STATUS_DEMANDA_CFG.ENVIADA_COORDENACAO;
            const catLabel =
              CATEGORIAS.find((c) => c.valor === d.categoria)?.label || d.categoria;
            const ehResponsavel = d.responsavel_id === usuarioLogado.id;

            return (
              <div
                key={d.id}
                className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between gap-4 shadow-lg"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                        {d.protocolo}
                      </span>
                      <span
                        className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${st.bg} ${st.text} ${st.border}`}
                      >
                        {st.label}
                      </span>
                      <PrioridadeBadge prioridade={d.prioridade} />
                    </div>
                    <span className="text-[11px] text-slate-500">{catLabel}</span>
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-white">{d.titulo}</h3>
                    {d.descricao && (
                      <p className="text-xs text-slate-300 mt-1 whitespace-pre-line">
                        {d.descricao}
                      </p>
                    )}
                  </div>

                  {d.acompanhamento_id && (
                    <button
                      type="button"
                      onClick={() => onVerPaciente && onVerPaciente(d.acompanhamento_id)}
                      className="inline-flex items-center gap-1.5 text-xs text-sky-300 hover:text-sky-200 bg-sky-500/10 px-3 py-1.5 rounded-lg border border-sky-500/25 cursor-pointer"
                    >
                      <User className="w-3.5 h-3.5" />
                      Paciente: <strong>{d.paciente_nome}</strong> (
                      {d.paciente_cns
                        ? `CNS ${formatarCNS(d.paciente_cns)}`
                        : `CPF ${formatarCPF(d.paciente_cpf)}`}
                      )
                    </button>
                  )}

                  {/* Fluxo de Participantes */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                    <div className="p-2.5 rounded-xl bg-slate-950/75 border border-slate-800">
                      <span className="text-[10px] uppercase text-slate-500 block">
                        1. Enviado por
                      </span>
                      <span className="font-semibold text-slate-200">{d.solicitante_nome}</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-950/75 border border-slate-800">
                      <span className="text-[10px] uppercase text-slate-500 block">
                        2. Coordenação
                      </span>
                      <span className="font-semibold text-[#f0cc82]">
                        {d.coordenador_nome || 'Aguardando recebimento'}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-950/75 border border-slate-800">
                      <span className="text-[10px] uppercase text-slate-500 block">
                        3. Responsável
                      </span>
                      <span className="font-semibold text-emerald-300">
                        {d.responsavel_nome || 'A definir'}
                      </span>
                    </div>
                  </div>

                  {/* Parecer da Coordenação */}
                  {d.parecer_coordenacao && (
                    <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-400/30 text-xs">
                      <span className="text-[10px] font-bold uppercase text-indigo-300 block">
                        Despacho da Coordenação:
                      </span>
                      <p className="text-slate-200 mt-0.5">{d.parecer_coordenacao}</p>
                    </div>
                  )}

                  {/* Parecer do Responsável */}
                  {d.parecer_responsavel && (
                    <div className="p-2.5 rounded-xl bg-[#C8963C]/10 border border-[#C8963C]/35 text-xs">
                      <span className="text-[10px] font-bold uppercase text-[#f0cc82] block">
                        Retorno de {d.responsavel_nome}:
                      </span>
                      <p className="text-slate-100 mt-0.5">{d.parecer_responsavel}</p>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-3 text-[10px] text-slate-500">
                    <span>Criada: {formatarDataHoraBR(d.criado_em)}</span>
                    {d.recebido_coord_em && (
                      <span>• Recebida Coord.: {formatarDataHoraBR(d.recebido_coord_em)}</span>
                    )}
                    {d.encaminhado_em && (
                      <span>• Encaminhada: {formatarDataHoraBR(d.encaminhado_em)}</span>
                    )}
                  </div>
                </div>

                {/* Ações do Fluxo */}
                <div className="pt-3 border-t border-slate-800 space-y-3">
                  {/* Ações da Coordenadora */}
                  {isCoordenador && d.status !== 'CONCLUIDA' && (
                    <div className="space-y-2.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        {d.status === 'ENVIADA_COORDENACAO' && (
                          <button
                            type="button"
                            onClick={() => handleReceberCoordenacao(d.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-200 border border-sky-400/40 text-xs font-semibold cursor-pointer"
                          >
                            <Inbox className="w-3.5 h-3.5" />
                            Confirmar Recebimento
                          </button>
                        )}

                        {['ENVIADA_COORDENACAO', 'RECEBIDA_COORDENACAO', 'DEVOLVIDA_COORDENACAO'].includes(
                          d.status
                        ) && (
                          <button
                            type="button"
                            onClick={() => {
                              setEncaminhandoId(encaminhandoId === d.id ? null : d.id);
                              setResponsavelId(
                                d.responsavel_id || colaboradoresAtivos[0]?.id || ''
                              );
                              setParecerCoord('');
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#085041] hover:bg-[#1D9E75] text-white text-xs font-semibold cursor-pointer"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            Encaminhar p/ Responsável
                          </button>
                        )}

                        {d.status === 'DEVOLVIDA_COORDENACAO' && (
                          <button
                            type="button"
                            onClick={() => handleConcluir(d.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold cursor-pointer ml-auto"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Concluir Fluxo
                          </button>
                        )}
                      </div>

                      {encaminhandoId === d.id && (
                        <div className="p-3 rounded-xl bg-slate-950 border border-[#1D9E75]/50 space-y-2.5">
                          <div>
                            <label className="block text-[11px] font-semibold text-emerald-300 mb-1">
                              Colaborador Responsável *
                            </label>
                            <select
                              value={responsavelId}
                              onChange={(e) => setResponsavelId(e.target.value)}
                              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                            >
                              {colaboradoresAtivos.map((u) => (
                                <option key={u.id} value={u.id}>
                                  {u.nome} ({u.cargo})
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-[11px] text-slate-300 mb-1">
                              Despacho / Orientação da Coordenação
                            </label>
                            <input
                              type="text"
                              value={parecerCoord}
                              onChange={(e) => setParecerCoord(e.target.value)}
                              placeholder="Ex: Priorizar agendamento ou entrar em contato com o paciente"
                              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                            />
                          </div>

                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setEncaminhandoId(null)}
                              className="px-3 py-1.5 rounded-lg text-xs bg-slate-800 text-slate-300 cursor-pointer"
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              onClick={() => handleEncaminhar(d.id)}
                              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[#1D9E75] text-white cursor-pointer"
                            >
                              Confirmar Encaminhamento
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Ações do Colaborador Responsável */}
                  {ehResponsavel && ['ENCAMINHADA', 'EM_EXECUCAO'].includes(d.status) && (
                    <div className="space-y-2.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        {d.status === 'ENCAMINHADA' && (
                          <button
                            type="button"
                            onClick={() => handleIniciarExecucao(d.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/20 text-purple-200 border border-purple-400/40 text-xs font-semibold cursor-pointer"
                          >
                            <Play className="w-3.5 h-3.5" /> Iniciar Atendimento
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            setDevolvendoId(devolvendoId === d.id ? null : d.id);
                            setParecerResp('');
                          }}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-[#085041] to-[#1D9E75] text-white text-xs font-semibold cursor-pointer ml-auto"
                        >
                          <RotateCcw className="w-3.5 h-3.5" /> Devolver à Coordenação
                        </button>
                      </div>

                      {devolvendoId === d.id && (
                        <div className="p-3 rounded-xl bg-slate-950 border border-[#C8963C]/50 space-y-2">
                          <label className="block text-[11px] font-semibold text-[#f0cc82]">
                            Parecer / Resolução para a Coordenação *
                          </label>
                          <textarea
                            rows={2}
                            value={parecerResp}
                            onChange={(e) => setParecerResp(e.target.value)}
                            placeholder="Descreva a providência tomada..."
                            className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setDevolvendoId(null)}
                              className="px-3 py-1.5 rounded-lg text-xs bg-slate-800 text-slate-300 cursor-pointer"
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              disabled={!parecerResp.trim()}
                              onClick={() => handleDevolverCoordenacao(d.id)}
                              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[#1D9E75] text-white disabled:opacity-50 cursor-pointer"
                            >
                              Enviar Retorno
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {!isCoordenador && !ehResponsavel && d.status !== 'CONCLUIDA' && (
                    <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-300" />
                      Status atual: <strong className="text-slate-200">{st.label}</strong>
                    </p>
                  )}

                  {d.status === 'CONCLUIDA' && (
                    <p className="text-[11px] text-emerald-300 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Fluxo concluído em {formatarDataHoraBR(d.concluido_em)}.
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}