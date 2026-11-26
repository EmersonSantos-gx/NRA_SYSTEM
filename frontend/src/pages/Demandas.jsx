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
  Clock,
  CalendarClock,
  CalendarCheck2
} from 'lucide-react';
import api from '../services/api';
import { formatarCNS, formatarCPF } from '../utils/validarCNS';
import { formatarDataHoraBR } from '../utils/formatters';
import { STATUS_CONFIG, PrioridadeBadge } from '../components/common/Badges';

const STATUS_DEMANDA_CFG = {
  ENVIADA_COORDENACAO: {
    label: 'Entrada / Enviada à Coordenação',
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
    label: 'Em Execução',
    bg: 'bg-purple-500/15',
    text: 'text-purple-200',
    border: 'border-purple-400/40'
  },
  AGUARDANDO_MARCACAO: {
    label: 'Aguardando Marcação',
    bg: 'bg-orange-500/15',
    text: 'text-orange-200',
    border: 'border-orange-400/40'
  },
  MARCADO: {
    label: 'Marcado',
    bg: 'bg-teal-500/20',
    text: 'text-teal-200',
    border: 'border-teal-400/45'
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
  const isSolicitante = usuarioLogado?.perfil === 'SOLICITANTE';

  // Formulário de abertura/envio de demanda para a Coordenação
  const [titulo, setTitulo] = useState('');
  const [categoria, setCategoria] = useState('REGULACAO_PACIENTE');
  const [prioridade, setPrioridade] = useState('NORMAL');
  const [acompanhamentoId, setAcompanhamentoId] = useState('');
  const [descricao, setDescricao] = useState('');
  const [enviando, setEnviando] = useState(false);

  // Filtros de visualização
  const [filtroAba, setFiltroAba] = useState(
    isCoordenador ? 'TRIAGEM' : isSolicitante ? 'TODAS_SOLICITANTE' : 'MINHAS_RECEBIDAS'
  );

  // Estados de encaminhamento pela Coordenadora
  const [encaminhandoId, setEncaminhandoId] = useState(null);
  const [responsavelId, setResponsavelId] = useState('');
  const [parecerCoord, setParecerCoord] = useState('');

  // Estado de marcação
  const [marcandoId, setMarcandoId] = useState(null);
  const [detalhesMarcacao, setDetalhesMarcacao] = useState('');

  // Estados de devolutiva pelo Colaborador Responsável
  const [devolvendoId, setDevolvendoId] = useState(null);
  const [parecerResp, setParecerResp] = useState('');

  const colaboradoresAtivos = useMemo(
    () => usuarios.filter((u) => u.ativo && u.perfil !== 'SOLICITANTE'),
    [usuarios]
  );

  const contadores = useMemo(() => {
    return {
      TRIAGEM: demandas.filter((d) =>
        ['ENVIADA_COORDENACAO', 'RECEBIDA_COORDENACAO'].includes(d.status)
      ).length,
      EM_FLUXO: demandas.filter((d) =>
        [
          'ENCAMINHADA',
          'EM_EXECUCAO',
          'AGUARDANDO_MARCACAO',
          'MARCADO',
          'DEVOLVIDA_COORDENACAO'
        ].includes(d.status)
      ).length,
      MINHAS_RECEBIDAS: demandas.filter(
        (d) =>
          d.responsavel_id === usuarioLogado.id &&
          ['ENCAMINHADA', 'EM_EXECUCAO', 'AGUARDANDO_MARCACAO', 'MARCADO'].includes(d.status)
      ).length,
      MINHAS_ENVIADAS: demandas.filter((d) => d.solicitante_id === usuarioLogado.id).length,
      TODAS_SOLICITANTE: demandas.length,
      AGUARDANDO_SOL: demandas.filter((d) => d.status === 'AGUARDANDO_MARCACAO').length,
      MARCADAS_SOL: demandas.filter((d) => d.status === 'MARCADO').length,
      CONCLUIDAS: demandas.filter((d) => d.status === 'CONCLUIDA').length
    };
  }, [demandas, usuarioLogado.id]);

  const listaFiltrada = useMemo(() => {
    if (isSolicitante) {
      if (filtroAba === 'AGUARDANDO_SOL') {
        return demandas.filter((d) => d.status === 'AGUARDANDO_MARCACAO');
      }
      if (filtroAba === 'MARCADAS_SOL') {
        return demandas.filter((d) => d.status === 'MARCADO');
      }
      if (filtroAba === 'CONCLUIDAS') {
        return demandas.filter((d) => d.status === 'CONCLUIDA');
      }
      return demandas;
    }

    if (filtroAba === 'TRIAGEM') {
      return demandas.filter((d) =>
        ['ENVIADA_COORDENACAO', 'RECEBIDA_COORDENACAO'].includes(d.status)
      );
    }
    if (filtroAba === 'EM_FLUXO') {
      return demandas.filter((d) =>
        [
          'ENCAMINHADA',
          'EM_EXECUCAO',
          'AGUARDANDO_MARCACAO',
          'MARCADO',
          'DEVOLVIDA_COORDENACAO'
        ].includes(d.status)
      );
    }
    if (filtroAba === 'MINHAS_RECEBIDAS') {
      return demandas.filter(
        (d) =>
          d.responsavel_id === usuarioLogado.id &&
          ['ENCAMINHADA', 'EM_EXECUCAO', 'AGUARDANDO_MARCACAO', 'MARCADO'].includes(d.status)
      );
    }
    if (filtroAba === 'MINHAS_ENVIADAS') {
      return demandas.filter((d) => d.solicitante_id === usuarioLogado.id);
    }
    return demandas.filter((d) => d.status === 'CONCLUIDA');
  }, [demandas, filtroAba, usuarioLogado.id, isSolicitante]);

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
      if (isSolicitante) setFiltroAba('TODAS_SOLICITANTE');
      else if (!isCoordenador) setFiltroAba('MINHAS_ENVIADAS');
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

  async function handleAguardandoMarcacao(id) {
    try {
      await api.patch(`/demandas/${id}/aguardando-marcacao`);
      await onRecarregar();
      onNotificar('Status atualizado para Aguardando Marcação.');
    } catch (err) {
      onNotificar(err.response?.data?.erro || 'Erro ao atualizar status.', 'erro');
    }
  }

  async function handleMarcarDemanda(id) {
    try {
      await api.patch(`/demandas/${id}/marcar`, {
        detalhes_marcacao: detalhesMarcacao
      });
      setMarcandoId(null);
      setDetalhesMarcacao('');
      await onRecarregar();
      onNotificar('Demanda atualizada para Marcado!');
    } catch (err) {
      onNotificar(err.response?.data?.erro || 'Erro ao registrar marcação.', 'erro');
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
          Fluxo de Envio e Acompanhamento de Demandas
        </h2>
        <p className="text-sm text-slate-400 mt-0.5">
          {isSolicitante
            ? 'Envie sua demanda e acompanhe em tempo real o histórico: Entrada, Recebido, Aguardando Marcação e Marcado.'
            : 'Envie pacientes ou solicitações para recebimento da Coordenação e direcionamento ao colaborador responsável.'}
        </p>
      </div>

      {/* Formulário: Registrar e Enviar Nova Demanda */}
      <form
        onSubmit={handleEnviarDemanda}
        className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl"
      >
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-300">
          <Send className="w-3.5 h-3.5" />
          Enviar Nova Demanda para a Coordenação
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div className="md:col-span-2">
            <label className="block text-xs text-slate-300 mb-1">
              Assunto / Nome do Paciente e Solicitação *
            </label>
            <input
              type="text"
              required
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex: Maria da Silva — Solicitação de Consulta Cardiologia"
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

          {!isSolicitante && acompanhamentos.length > 0 && (
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
          )}

          <div
            className={`${
              !isSolicitante && acompanhamentos.length > 0 ? 'md:col-span-2' : 'md:col-span-4'
            } flex flex-col justify-end`}
          >
            <label className="block text-xs text-slate-300 mb-1">
              Dados do Paciente (CNS/CPF, Telefone) e Observações
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Informe CNS/CPF, telefone de contato e detalhes da solicitação..."
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white"
              />
              <button
                type="submit"
                disabled={enviando}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#085041] to-[#1D9E75] text-white text-xs font-semibold shrink-0 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                {enviando ? 'Enviando...' : 'Enviar Demanda'}
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* Abas de Filtro */}
      <div className="flex items-center gap-2 flex-wrap">
        {isSolicitante ? (
          <>
            <button
              onClick={() => setFiltroAba('TODAS_SOLICITANTE')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold border cursor-pointer ${
                filtroAba === 'TODAS_SOLICITANTE'
                  ? 'bg-[#085041]/40 text-emerald-200 border-[#1D9E75]/60'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
              }`}
            >
              Todas Enviadas ({contadores.TODAS_SOLICITANTE})
            </button>
            <button
              onClick={() => setFiltroAba('AGUARDANDO_SOL')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold border cursor-pointer ${
                filtroAba === 'AGUARDANDO_SOL'
                  ? 'bg-orange-500/20 text-orange-200 border-orange-400/50'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
              }`}
            >
              Aguardando Marcação ({contadores.AGUARDANDO_SOL})
            </button>
            <button
              onClick={() => setFiltroAba('MARCADAS_SOL')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold border cursor-pointer ${
                filtroAba === 'MARCADAS_SOL'
                  ? 'bg-teal-500/20 text-teal-200 border-teal-400/50'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
              }`}
            >
              Marcadas ({contadores.MARCADAS_SOL})
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
        ) : isCoordenador ? (
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
              Em Andamento / Marcação ({contadores.EM_FLUXO})
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
            const podeGerirMarcacao = isCoordenador || ehResponsavel;

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
                      disabled={!onVerPaciente}
                      onClick={() => onVerPaciente && onVerPaciente(d.acompanhamento_id)}
                      className={`inline-flex items-center gap-1.5 text-xs text-sky-300 bg-sky-500/10 px-3 py-1.5 rounded-lg border border-sky-500/25 ${
                        onVerPaciente ? 'hover:text-sky-200 cursor-pointer' : 'cursor-default'
                      }`}
                    >
                      <User className="w-3.5 h-3.5" />
                      Paciente: <strong>{d.paciente_nome}</strong> (
                      {d.paciente_cns
                        ? `CNS ${formatarCNS(d.paciente_cns)}`
                        : `CPF ${formatarCPF(d.paciente_cpf)}`}
                      )
                    </button>
                  )}

                  {/* Histórico Visual Completo (Entrada -> Recebido -> Aguardando Marcação -> Marcado) */}
                  <div className="p-3 rounded-xl bg-slate-950/85 border border-slate-800 space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Histórico de Movimentação da Demanda
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                      <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800">
                        <span className="text-slate-400">1. Entrada:</span>
                        <span className="font-semibold text-white">
                          {formatarDataHoraBR(d.criado_em)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800">
                        <span className="text-slate-400">2. Recebido:</span>
                        <span
                          className={`font-semibold ${
                            d.recebido_coord_em ? 'text-sky-300' : 'text-slate-500'
                          }`}
                        >
                          {d.recebido_coord_em
                            ? formatarDataHoraBR(d.recebido_coord_em)
                            : 'Aguardando'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800">
                        <span className="text-slate-400">3. Aguardando Marcação:</span>
                        <span
                          className={`font-semibold ${
                            d.aguardando_marcacao_em ? 'text-orange-300' : 'text-slate-500'
                          }`}
                        >
                          {d.aguardando_marcacao_em
                            ? formatarDataHoraBR(d.aguardando_marcacao_em)
                            : '—'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800">
                        <span className="text-slate-400">4. Marcado:</span>
                        <span
                          className={`font-semibold ${
                            d.marcado_em ? 'text-teal-300' : 'text-slate-500'
                          }`}
                        >
                          {d.marcado_em ? formatarDataHoraBR(d.marcado_em) : '—'}
                        </span>
                      </div>
                    </div>

                    {d.detalhes_marcacao && (
                      <div className="p-2 rounded-lg bg-teal-500/10 border border-teal-500/30 text-xs text-teal-200">
                        <strong>Informação da Marcação:</strong> {d.detalhes_marcacao}
                      </div>
                    )}
                  </div>

                  {/* Responsáveis */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                    <div className="p-2.5 rounded-xl bg-slate-950/75 border border-slate-800">
                      <span className="text-[10px] uppercase text-slate-500 block">
                        Solicitante
                      </span>
                      <span className="font-semibold text-slate-200">{d.solicitante_nome}</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-950/75 border border-slate-800">
                      <span className="text-[10px] uppercase text-slate-500 block">
                        Coordenação
                      </span>
                      <span className="font-semibold text-[#f0cc82]">
                        {d.coordenador_nome || 'Aguardando'}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-950/75 border border-slate-800">
                      <span className="text-[10px] uppercase text-slate-500 block">
                        Responsável
                      </span>
                      <span className="font-semibold text-emerald-300">
                        {d.responsavel_nome || 'A definir'}
                      </span>
                    </div>
                  </div>

                  {d.parecer_coordenacao && (
                    <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-400/30 text-xs">
                      <span className="text-[10px] font-bold uppercase text-indigo-300 block">
                        Despacho da Coordenação:
                      </span>
                      <p className="text-slate-200 mt-0.5">{d.parecer_coordenacao}</p>
                    </div>
                  )}

                  {d.parecer_responsavel && (
                    <div className="p-2.5 rounded-xl bg-[#C8963C]/10 border border-[#C8963C]/35 text-xs">
                      <span className="text-[10px] font-bold uppercase text-[#f0cc82] block">
                        Retorno de {d.responsavel_nome}:
                      </span>
                      <p className="text-slate-100 mt-0.5">{d.parecer_responsavel}</p>
                    </div>
                  )}
                </div>

                {/* Rodapé de Ações (oculto para perfil SOLICITANTE, que apenas visualiza o histórico) */}
                {!isSolicitante && (
                  <div className="pt-3 border-t border-slate-800 space-y-3">
                    {d.status !== 'CONCLUIDA' && (
                      <div className="flex items-center gap-2 flex-wrap">
                        {isCoordenador && d.status === 'ENVIADA_COORDENACAO' && (
                          <button
                            type="button"
                            onClick={() => handleReceberCoordenacao(d.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-200 border border-sky-400/40 text-xs font-semibold cursor-pointer"
                          >
                            <Inbox className="w-3.5 h-3.5" />
                            Confirmar Recebimento
                          </button>
                        )}

                        {isCoordenador &&
                          [
                            'ENVIADA_COORDENACAO',
                            'RECEBIDA_COORDENACAO',
                            'DEVOLVIDA_COORDENACAO'
                          ].includes(d.status) && (
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

                        {ehResponsavel && d.status === 'ENCAMINHADA' && (
                          <button
                            type="button"
                            onClick={() => handleIniciarExecucao(d.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/20 text-purple-200 border border-purple-400/40 text-xs font-semibold cursor-pointer"
                          >
                            <Play className="w-3.5 h-3.5" /> Iniciar
                          </button>
                        )}

                        {podeGerirMarcacao &&
                          !['AGUARDANDO_MARCACAO', 'MARCADO'].includes(d.status) && (
                            <button
                              type="button"
                              onClick={() => handleAguardandoMarcacao(d.id)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500/20 hover:bg-orange-500/30 text-orange-200 border border-orange-400/40 text-xs font-semibold cursor-pointer"
                            >
                              <CalendarClock className="w-3.5 h-3.5" />
                              Aguardando Marcação
                            </button>
                          )}

                        {podeGerirMarcacao && d.status !== 'MARCADO' && (
                          <button
                            type="button"
                            onClick={() => {
                              setMarcandoId(marcandoId === d.id ? null : d.id);
                              setDetalhesMarcacao('');
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-600/80 hover:bg-teal-500 text-white text-xs font-semibold cursor-pointer"
                          >
                            <CalendarCheck2 className="w-3.5 h-3.5" />
                            Marcar
                          </button>
                        )}

                        {ehResponsavel &&
                          ['ENCAMINHADA', 'EM_EXECUCAO', 'AGUARDANDO_MARCACAO', 'MARCADO'].includes(
                            d.status
                          ) && (
                            <button
                              type="button"
                              onClick={() => {
                                setDevolvendoId(devolvendoId === d.id ? null : d.id);
                                setParecerResp('');
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-[#f0cc82] border border-[#C8963C]/40 text-xs font-semibold cursor-pointer"
                            >
                              <RotateCcw className="w-3.5 h-3.5" /> Devolver Coordenação
                            </button>
                          )}

                        {isCoordenador &&
                          ['DEVOLVIDA_COORDENACAO', 'MARCADO'].includes(d.status) && (
                            <button
                              type="button"
                              onClick={() => handleConcluir(d.id)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold cursor-pointer ml-auto"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Concluir
                            </button>
                          )}
                      </div>
                    )}

                    {/* Form: Registrar Detalhes da Marcação */}
                    {marcandoId === d.id && (
                      <div className="p-3 rounded-xl bg-slate-950 border border-teal-500/50 space-y-2">
                        <label className="block text-[11px] font-semibold text-teal-300">
                          Detalhes do Agendamento / Marcação (visível ao Solicitante)
                        </label>
                        <input
                          type="text"
                          value={detalhesMarcacao}
                          onChange={(e) => setDetalhesMarcacao(e.target.value)}
                          placeholder="Ex: Marcado para 02/12/2026 às 09:00 — PAM Salgadinho Sede"
                          className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setMarcandoId(null)}
                            className="px-3 py-1.5 rounded-lg text-xs bg-slate-800 text-slate-300 cursor-pointer"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMarcarDemanda(d.id)}
                            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-teal-600 text-white cursor-pointer"
                          >
                            Confirmar Marcado
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Form: Encaminhar para Responsável */}
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
                            placeholder="Ex: Providenciar marcação na especialidade solicitada"
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

                    {/* Form: Devolver à Coordenação */}
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

                    {d.status === 'CONCLUIDA' && (
                      <p className="text-[11px] text-emerald-300 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Fluxo concluído em {formatarDataHoraBR(d.concluido_em)}.
                      </p>
                    )}
                  </div>
                )}

                {isSolicitante && (
                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-[#1D9E75]" />
                      Status atual: <strong className="text-white">{st.label}</strong>
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}