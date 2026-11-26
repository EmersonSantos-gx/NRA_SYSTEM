import { useMemo, useState } from 'react';
import {
  Search,
  Table,
  Columns,
  Download,
  Plus,
  MessageCircle,
  RotateCcw
} from 'lucide-react';
import api from '../services/api';
import { somenteDigitos, formatarCNS, formatarCPF } from '../utils/validarCNS';
import {
  calcularDiasEspera,
  isMenorDeIdade,
  formatarAgendamentoResumo,
  montarLinkWhatsApp,
  exportarParaCSV
} from '../utils/formatters';
import {
  STATUS_CONFIG,
  PRIORIDADE_CONFIG,
  StatusBadge,
  PrioridadeBadge,
  ReincidenteBadge
} from '../components/common/Badges';

const COLUNAS = ['NOVO', 'PENDENTE', 'MARCADO', 'REALIZADO', 'FALTOU'];

export default function FilaPacientes({
  acompanhamentos,
  procedimentos,
  filtroStatusInicial,
  onNovoAcompanhamento,
  onVerDetalhes,
  onAlternarAviso,
  onConfirmarComparecimento,
  onVoltarParaNovo,
  onIniciarTransicao,
  onNotificar
}) {
  const [busca, setBusca] = useState('');
  const [filtroProcedimento, setFiltroProcedimento] = useState('TODOS');
  const [filtroPrioridade, setFiltroPrioridade] = useState('TODAS');
  const [filtroStatus, setFiltroStatus] = useState(filtroStatusInicial || 'TODOS');
  const [modo, setModo] = useState('tabela');
  const [processandoNovoId, setProcessandoNovoId] = useState(null);
  const [statusLocalOverride, setStatusLocalOverride] = useState({});

  const listaAtualizada = useMemo(
    () =>
      acompanhamentos.map((item) =>
        statusLocalOverride[item.id]
          ? {
              ...item,
              status: statusLocalOverride[item.id],
              motivo_pendencia: '',
              data_agendamento: '',
              hora_agendamento: '',
              local_agendamento: '',
              aviso_confirmado: false
            }
          : item
      ),
    [acompanhamentos, statusLocalOverride]
  );

  async function handleCliqueVoltarNovo(id) {
    try {
      setProcessandoNovoId(id);
      if (onVoltarParaNovo) {
        await onVoltarParaNovo(id);
      } else {
        await api.patch(`/acompanhamentos/${id}/status`, { status_destino: 'NOVO' });
        setStatusLocalOverride((prev) => ({ ...prev, [id]: 'NOVO' }));
        if (onNotificar) onNotificar('Paciente retornado para a fila como Novo.');
      }
    } catch (err) {
      if (onNotificar) {
        onNotificar(err.response?.data?.erro || 'Erro ao retornar paciente para Novo.', 'erro');
      }
    } finally {
      setProcessandoNovoId(null);
    }
  }

  const kpis = useMemo(
    () => ({
      NOVO: listaAtualizada.filter((a) => a.status === 'NOVO').length,
      PENDENTE: listaAtualizada.filter((a) => a.status === 'PENDENTE').length,
      MARCADO: listaAtualizada.filter((a) => a.status === 'MARCADO').length,
      REALIZADO: listaAtualizada.filter((a) => a.status === 'REALIZADO').length,
      FALTOU: listaAtualizada.filter((a) => a.status === 'FALTOU').length
    }),
    [listaAtualizada]
  );

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const digitos = somenteDigitos(busca);

    return listaAtualizada.filter((item) => {
      if (filtroStatus !== 'TODOS' && item.status !== filtroStatus) return false;
      if (filtroProcedimento !== 'TODOS' && item.procedimento_id !== filtroProcedimento) return false;
      if (filtroPrioridade !== 'TODAS' && item.prioridade !== filtroPrioridade) return false;

      if (termo) {
        const bateNome = (item.nome_paciente || '').toLowerCase().includes(termo);
        const bateCNS = digitos.length > 0 && String(item.cns || '').includes(digitos);
        const bateCPF = digitos.length > 0 && String(item.cpf || '').includes(digitos);
        const bateProc = (item.procedimento_nome || '').toLowerCase().includes(termo);
        if (!bateNome && !bateCNS && !bateCPF && !bateProc) return false;
      }
      return true;
    });
  }, [listaAtualizada, busca, filtroProcedimento, filtroPrioridade, filtroStatus]);

  function handleExportarCSV() {
    const cabecalhos = [
      'Paciente',
      'Documento',
      'Prioridade',
      'Procedimento',
      'Status',
      'Aviso Confirmado',
      'Agendamento',
      'Local',
      'Pendência / Falta',
      'Total Faltas'
    ];
    const linhas = filtrados.map((item) => [
      item.nome_paciente,
      item.cns
        ? `CNS ${formatarCNS(item.cns)}`
        : item.cpf
          ? `CPF ${formatarCPF(item.cpf)} (Provisório)`
          : '',
      PRIORIDADE_CONFIG[item.prioridade]?.label || item.prioridade,
      item.procedimento_nome || '',
      STATUS_CONFIG[item.status]?.label || item.status,
      item.aviso_confirmado ? 'Sim' : 'Não',
      formatarAgendamentoResumo(item.data_agendamento, item.hora_agendamento),
      item.local_agendamento || '',
      item.motivo_pendencia || item.motivo_falta || '',
      item.total_faltas || 0
    ]);
    exportarParaCSV('regulasus_fila_pacientes.csv', cabecalhos, linhas);
    onNotificar(`Lista exportada (${filtrados.length} pacientes).`);
  }

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {COLUNAS.map((st) => {
          const cfg = STATUS_CONFIG[st];
          const ativo = filtroStatus === st;
          return (
            <button
              key={st}
              onClick={() => setFiltroStatus(ativo ? 'TODOS' : st)}
              className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                ativo
                  ? `${cfg.bg} ${cfg.border} shadow-md`
                  : 'bg-slate-900/75 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-300">{cfg.label}</span>
                <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
              </div>
              <p className={`text-2xl font-extrabold mt-1.5 ${cfg.text}`}>{kpis[st]}</p>
            </button>
          );
        })}
      </div>

      {/* Filtros */}
      <div className="bg-slate-900/75 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome do paciente, CNS, CPF ou procedimento..."
              className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#1D9E75]"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-1">
              <button
                onClick={() => setModo('tabela')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                  modo === 'tabela' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Table className="w-3.5 h-3.5" /> Tabela
              </button>
              <button
                onClick={() => setModo('kanban')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                  modo === 'kanban' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Columns className="w-3.5 h-3.5" /> Kanban
              </button>
            </div>

            <button
              onClick={handleExportarCSV}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-300 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-[#1D9E75]" /> CSV
            </button>

            <button
              onClick={onNovoAcompanhamento}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#085041] to-[#1D9E75] text-white text-xs font-semibold shadow-md cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Novo Paciente
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <select
            value={filtroProcedimento}
            onChange={(e) => setFiltroProcedimento(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200"
          >
            <option value="TODOS">Todos os procedimentos</option>
            {procedimentos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>

          <select
            value={filtroPrioridade}
            onChange={(e) => setFiltroPrioridade(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200"
          >
            <option value="TODAS">Todas as prioridades</option>
            {Object.entries(PRIORIDADE_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>

          <select
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200"
          >
            <option value="TODOS">Todos os status</option>
            {COLUNAS.map((st) => (
              <option key={st} value={st}>
                {STATUS_CONFIG[st].label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabela ou Kanban */}
      {modo === 'tabela' ? (
        <div className="bg-slate-900/75 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          {filtrados.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">
              Nenhum paciente encontrado.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/70 text-[11px] uppercase tracking-wider text-slate-400">
                    <th className="py-3.5 px-4 font-semibold">Paciente / Documento</th>
                    <th className="py-3.5 px-4 font-semibold">Procedimento</th>
                    <th className="py-3.5 px-4 font-semibold">Status / SLA</th>
                    <th className="py-3.5 px-4 font-semibold">Situação / Agendamento</th>
                    <th className="py-3.5 px-4 font-semibold text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70 text-sm">
                  {filtrados.map((item) => {
                    const dias = calcularDiasEspera(item.criado_em);
                    const linkWpp = item.status === 'MARCADO' ? montarLinkWhatsApp(item) : null;
                    const menor = isMenorDeIdade(item.data_nascimento);

                    return (
                      <tr
                        key={item.id}
                        onClick={() => onVerDetalhes(item.id)}
                        className="hover:bg-slate-800/50 transition-colors cursor-pointer"
                      >
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-white text-xs sm:text-sm">
                              {item.nome_paciente}
                            </span>
                            <PrioridadeBadge prioridade={item.prioridade} />
                            {menor && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#C8963C]/20 text-[#f0cc82] border border-[#C8963C]/40">
                                Menor
                              </span>
                            )}
                            <ReincidenteBadge totalFaltas={item.total_faltas} />
                          </div>
                          <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                            {item.cns ? (
                              `CNS: ${formatarCNS(item.cns)}`
                            ) : (
                              <span className="text-[#f0cc82]">
                                CPF provisório: {formatarCPF(item.cpf)}
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="text-slate-200 font-medium text-xs">
                            {item.procedimento_nome}
                          </div>
                          <div className="text-[11px] text-slate-400">{item.especialidade}</div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex flex-col items-start gap-1">
                            <StatusBadge status={item.status} />
                            {(item.status === 'NOVO' || item.status === 'PENDENTE') && (
                              <span
                                className={`text-[10px] font-medium ${
                                  dias >= 10 ? 'text-amber-300' : 'text-slate-400'
                                }`}
                              >
                                Na fila há {dias} dia(s)
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-xs" onClick={(e) => e.stopPropagation()}>
                          {item.status === 'PENDENTE' && (
                            <p className="text-[#f0cc82] max-w-xs">{item.motivo_pendencia}</p>
                          )}
                          {item.status === 'FALTOU' && (
                            <p className="text-rose-300 max-w-xs">{item.motivo_falta}</p>
                          )}
                          {(item.status === 'MARCADO' || item.status === 'REALIZADO') && (
                            <div className="space-y-1">
                              <p className="text-slate-200 font-medium">
                                {formatarAgendamentoResumo(
                                  item.data_agendamento,
                                  item.hora_agendamento
                                )}
                              </p>
                              <p className="text-[11px] text-slate-400">{item.local_agendamento}</p>
                              {item.status === 'MARCADO' && (
                                <label className="inline-flex items-center gap-1.5 text-[11px] text-emerald-300 cursor-pointer pt-0.5">
                                  <input
                                    type="checkbox"
                                    checked={Boolean(item.aviso_confirmado)}
                                    onChange={() => onAlternarAviso(item.id)}
                                    className="accent-[#1D9E75]"
                                  />
                                  Aviso confirmado
                                </label>
                              )}
                            </div>
                          )}
                          {item.status === 'NOVO' && (
                            <span className="text-slate-500">Aguardando triagem</span>
                          )}
                        </td>

                        <td
                          className="py-3.5 px-4 text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="inline-flex items-center justify-end gap-1.5 flex-wrap">
                            {(item.status === 'NOVO' || item.status === 'PENDENTE') && (
                              <>
                                {item.status === 'NOVO' && (
                                  <button
                                    onClick={() => onIniciarTransicao(item.id, 'PENDENTE')}
                                    className="px-2.5 py-1 rounded-lg bg-[#C8963C]/20 text-[#f0cc82] border border-[#C8963C]/40 text-[11px] font-semibold cursor-pointer"
                                  >
                                    Pendência
                                  </button>
                                )}
                                <button
                                  onClick={() => onIniciarTransicao(item.id, 'MARCADO')}
                                  className="px-2.5 py-1 rounded-lg bg-[#085041] hover:bg-[#1D9E75] text-white text-[11px] font-semibold cursor-pointer"
                                >
                                  Marcar
                                </button>
                              </>
                            )}
                            {item.status === 'MARCADO' && (
                              <>
                                {linkWpp && (
                                  <a
                                    href={linkWpp}
                                    target="_blank"
                                    rel="noreferrer"
                                    title="Confirmar via WhatsApp"
                                    className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                                  >
                                    <MessageCircle className="w-3.5 h-3.5" />
                                  </a>
                                )}
                                <button
                                  onClick={() => onConfirmarComparecimento(item.id)}
                                  className="px-2.5 py-1 rounded-lg bg-teal-600/80 hover:bg-teal-500 text-white text-[11px] font-semibold cursor-pointer"
                                >
                                  Realizado
                                </button>
                                <button
                                  onClick={() => onIniciarTransicao(item.id, 'FALTOU')}
                                  className="px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-200 border border-rose-500/40 text-[11px] font-semibold cursor-pointer"
                                >
                                  Falta
                                </button>
                              </>
                            )}
                            {item.status === 'FALTOU' && (
                              <button
                                onClick={() => onIniciarTransicao(item.id, 'MARCADO')}
                                className="px-2.5 py-1 rounded-lg bg-[#085041] hover:bg-[#1D9E75] text-white text-[11px] font-semibold cursor-pointer"
                              >
                                Reagendar
                              </button>
                            )}

                            {/* Botão para retornar o paciente à fila inicial como NOVO */}
                            {item.status !== 'NOVO' && (
                              <button
                                type="button"
                                disabled={processandoNovoId === item.id}
                                onClick={() => handleCliqueVoltarNovo(item.id)}
                                title="Voltar para fila como Novo"
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 disabled:opacity-50 text-sky-300 border border-sky-400/35 text-[11px] font-semibold cursor-pointer"
                              >
                                <RotateCcw className="w-3 h-3" />
                                {processandoNovoId === item.id ? '...' : 'Novo'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
          {COLUNAS.map((st) => {
            const cfg = STATUS_CONFIG[st];
            const lista = filtrados.filter((a) => a.status === st);
            return (
              <div
                key={st}
                className="bg-slate-900/60 border border-slate-800 rounded-2xl p-3 flex flex-col gap-3 min-h-[280px]"
              >
                <div className="flex items-center justify-between px-1 pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                    <h3 className="text-xs font-bold uppercase text-slate-200">{cfg.label}</h3>
                  </div>
                  <span className="text-xs font-bold text-slate-400">{lista.length}</span>
                </div>
                <div className="space-y-2.5">
                  {lista.length === 0 ? (
                    <p className="text-[11px] text-slate-500 text-center py-6">Sem registros</p>
                  ) : (
                    lista.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => onVerDetalhes(item.id)}
                        className="p-3 rounded-xl bg-slate-950/90 hover:bg-slate-800/80 border border-slate-800 cursor-pointer space-y-1.5"
                      >
                        <div className="flex items-start justify-between gap-1.5">
                          <p className="text-xs font-bold text-white">{item.nome_paciente}</p>
                          <PrioridadeBadge prioridade={item.prioridade} />
                        </div>
                        <p className="text-[11px] text-slate-400 truncate">
                          {item.procedimento_nome}
                        </p>
                        {!item.cns && item.cpf && (
                          <p className="text-[10px] font-mono text-[#f0cc82]">
                            CPF provisório: {formatarCPF(item.cpf)}
                          </p>
                        )}
                        <ReincidenteBadge totalFaltas={item.total_faltas} />
                        {item.data_agendamento && (
                          <p className="text-[10px] text-emerald-300">
                            {formatarAgendamentoResumo(item.data_agendamento, item.hora_agendamento)}
                          </p>
                        )}
                      </div>
                    ))
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