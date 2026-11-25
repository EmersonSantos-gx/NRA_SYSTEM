import { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import {
  formatarDataBR,
  formatarAgendamentoResumo,
  formatarPercentualBR,
  obterFaixaAbsenteismo,
  exportarParaCSV
} from '../utils/formatters';
import { formatarCNS } from '../utils/validarCNS';
import { STATUS_CONFIG, ReincidenteBadge } from '../components/common/Badges';

const NOMES_MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function gerarUltimosMeses(qtd = 3) {
  const hoje = new Date();
  const lista = [];
  for (let i = 0; i < qtd; i++) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    const ano = d.getFullYear();
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    lista.push({
      valor: `${ano}-${mes}`,
      curto: `${NOMES_MESES[d.getMonth()]}/${String(ano).slice(-2)}`,
      label: `${NOMES_MESES[d.getMonth()]}/${ano}`
    });
  }
  return [...lista, { valor: 'TODOS', curto: 'Geral', label: 'Acumulado Geral' }];
}

export default function Dashboard({
  acompanhamentos,
  onIrParaFila,
  onVerDetalhes,
  onReagendar,
  onNotificar
}) {
  const mesesDisponiveis = useMemo(() => gerarUltimosMeses(3), []);
  const [mesSelecionado, setMesSelecionado] = useState(mesesDisponiveis[0].valor);

  const kpisFila = useMemo(
    () => ({
      NOVO: acompanhamentos.filter((a) => a.status === 'NOVO').length,
      PENDENTE: acompanhamentos.filter((a) => a.status === 'PENDENTE').length,
      MARCADO: acompanhamentos.filter((a) => a.status === 'MARCADO').length,
      REALIZADO: acompanhamentos.filter((a) => a.status === 'REALIZADO').length,
      FALTOU: acompanhamentos.filter((a) => a.status === 'FALTOU').length
    }),
    [acompanhamentos]
  );

  const registrosPeriodo = useMemo(() => {
    return acompanhamentos.filter((a) => {
      if (!a.data_agendamento) return false;
      if (!['MARCADO', 'REALIZADO', 'FALTOU'].includes(a.status)) return false;
      if (mesSelecionado === 'TODOS') return true;
      return a.data_agendamento.startsWith(mesSelecionado);
    });
  }, [acompanhamentos, mesSelecionado]);

  const metricas = useMemo(() => {
    const marcadosTotal = registrosPeriodo.length;
    const realizados = registrosPeriodo.filter((r) => r.status === 'REALIZADO').length;
    const faltas = registrosPeriodo.filter((r) => r.status === 'FALTOU').length;
    const futuros = registrosPeriodo.filter((r) => r.status === 'MARCADO').length;
    const desfechos = realizados + faltas;
    const absenteismo = desfechos > 0 ? (faltas / desfechos) * 100 : 0;
    return {
      marcadosTotal,
      realizados,
      faltas,
      futuros,
      desfechos,
      absenteismo,
      faixa: obterFaixaAbsenteismo(absenteismo)
    };
  }, [registrosPeriodo]);

  const evolucaoMensal = useMemo(() => {
    const meses = mesesDisponiveis.filter((m) => m.valor !== 'TODOS').reverse();
    return meses.map((m) => {
      const lista = acompanhamentos.filter(
        (a) =>
          a.data_agendamento &&
          a.data_agendamento.startsWith(m.valor) &&
          ['MARCADO', 'REALIZADO', 'FALTOU'].includes(a.status)
      );
      const realizados = lista.filter((r) => r.status === 'REALIZADO').length;
      const faltas = lista.filter((r) => r.status === 'FALTOU').length;
      const futuros = lista.filter((r) => r.status === 'MARCADO').length;
      const desfechos = realizados + faltas;
      const pct = desfechos > 0 ? (faltas / desfechos) * 100 : 0;
      return { ...m, total: lista.length, realizados, faltas, futuros, pct };
    });
  }, [acompanhamentos, mesesDisponiveis]);

  const maxBarraMensal = Math.max(...evolucaoMensal.map((e) => e.total), 1);

  const rankingProcedimentos = useMemo(() => {
    const mapa = {};
    registrosPeriodo.forEach((item) => {
      const pid = item.procedimento_id;
      if (!mapa[pid]) {
        mapa[pid] = {
          id: pid,
          nome: item.procedimento_nome || 'Procedimento',
          realizados: 0,
          faltas: 0,
          futuros: 0
        };
      }
      if (item.status === 'REALIZADO') mapa[pid].realizados++;
      else if (item.status === 'FALTOU') mapa[pid].faltas++;
      else if (item.status === 'MARCADO') mapa[pid].futuros++;
    });

    return Object.values(mapa)
      .map((entry) => {
        const desfechos = entry.realizados + entry.faltas;
        const pct = desfechos > 0 ? (entry.faltas / desfechos) * 100 : 0;
        return { ...entry, desfechos, percentual: pct, faixa: obterFaixaAbsenteismo(pct) };
      })
      .sort((a, b) => b.percentual - a.percentual || b.faltas - a.faltas);
  }, [registrosPeriodo]);

  const faltososPeriodo = useMemo(
    () => registrosPeriodo.filter((r) => r.status === 'FALTOU'),
    [registrosPeriodo]
  );

  const labelPeriodoAtual =
    mesesDisponiveis.find((m) => m.valor === mesSelecionado)?.label || 'Período';

  function handleExportarCSV() {
    const cabecalhos = [
      'Paciente',
      'CNS',
      'Procedimento',
      'Status',
      'Data Agendamento',
      'Horário',
      'Local',
      'Motivo da Falta',
      'Total Faltas'
    ];
    const linhas = registrosPeriodo.map((item) => [
      item.nome_paciente,
      formatarCNS(item.cns),
      item.procedimento_nome || '',
      STATUS_CONFIG[item.status]?.label || item.status,
      formatarDataBR(item.data_agendamento),
      item.hora_agendamento || '',
      item.local_agendamento || '',
      item.motivo_falta || '',
      item.total_faltas || 0
    ]);
    exportarParaCSV(`regulasus_absenteismo_${mesSelecionado}.csv`, cabecalhos, linhas);
    onNotificar(`Relatório CSV (${labelPeriodoAtual}) exportado.`);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Dashboard de Absenteísmo</h2>
          <p className="text-sm text-slate-400 mt-0.5">
            Fórmula: <strong className="text-slate-200">Faltosos ÷ (Realizados + Faltosos)</strong> •{' '}
            {labelPeriodoAtual}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-1">
            {mesesDisponiveis.map((m) => (
              <button
                key={m.valor}
                onClick={() => setMesSelecionado(m.valor)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  mesSelecionado === m.valor
                    ? 'bg-gradient-to-r from-[#085041] to-[#1D9E75] text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {m.curto}
              </button>
            ))}
          </div>

          <button
            onClick={handleExportarCSV}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-[#1D9E75]" />
            Exportar CSV
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Marcados no Período
          </p>
          <p className="text-3xl font-extrabold text-white mt-2">{metricas.marcadosTotal}</p>
          <p className="text-xs text-slate-400 mt-1.5">
            {metricas.futuros} futuro(s) • {metricas.desfechos} concluído(s)
          </p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg">
          <p className="text-xs font-semibold text-teal-300 uppercase tracking-wider">
            Realizados (Compareceram)
          </p>
          <p className="text-3xl font-extrabold text-teal-200 mt-2">{metricas.realizados}</p>
          <p className="text-xs text-slate-400 mt-1.5">Atendimentos efetivados</p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg">
          <p className="text-xs font-semibold text-rose-300 uppercase tracking-wider">
            Faltas no Período
          </p>
          <p className="text-3xl font-extrabold text-rose-300 mt-2">{metricas.faltas}</p>
          <p className="text-xs text-slate-400 mt-1.5">Pacientes faltosos</p>
        </div>

        <div className={`rounded-2xl p-5 shadow-lg border ${metricas.faixa.bg} ${metricas.faixa.borda}`}>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
              Absenteísmo
            </p>
            <span
              className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border ${metricas.faixa.bg} ${metricas.faixa.text} ${metricas.faixa.borda}`}
            >
              {metricas.faixa.label}
            </span>
          </div>
          <p className={`text-3xl font-extrabold mt-2 ${metricas.faixa.text}`}>
            {formatarPercentualBR(metricas.absenteismo)}
          </p>
          <div className="w-full h-2 rounded-full bg-slate-950/70 mt-3 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${metricas.faixa.barra}`}
              style={{ width: `${Math.min(metricas.absenteismo, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Resumo da Fila */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { key: 'NOVO', label: 'Novos na Fila', val: kpisFila.NOVO, cor: 'text-sky-300' },
          { key: 'PENDENTE', label: 'Pendentes', val: kpisFila.PENDENTE, cor: 'text-[#f0cc82]' },
          { key: 'MARCADO', label: 'Marcados', val: kpisFila.MARCADO, cor: 'text-emerald-300' },
          { key: 'REALIZADO', label: 'Realizados', val: kpisFila.REALIZADO, cor: 'text-teal-200' },
          { key: 'FALTOU', label: 'Faltosos', val: kpisFila.FALTOU, cor: 'text-rose-300' }
        ].map((item) => (
          <button
            key={item.key}
            onClick={() => onIrParaFila(item.key)}
            className="bg-slate-900/60 hover:bg-slate-900 border border-slate-800 rounded-xl p-3 text-left transition-all cursor-pointer"
          >
            <p className="text-[11px] text-slate-400">{item.label}</p>
            <p className={`text-xl font-bold mt-0.5 ${item.cor}`}>{item.val}</p>
          </button>
        ))}
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-6 bg-slate-900/75 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2 mb-4">
            <div>
              <h3 className="text-sm font-bold text-white">Evolução Mensal</h3>
              <p className="text-xs text-slate-400">Clique em uma coluna para filtrar o mês</p>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-slate-400">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-teal-400" /> Realiz.
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-rose-400" /> Faltas
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500/60" /> Futuros
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 items-end h-52 pt-4">
            {evolucaoMensal.map((m) => {
              const ativo = mesSelecionado === m.valor;
              const altReal = (m.realizados / maxBarraMensal) * 100;
              const altFalta = (m.faltas / maxBarraMensal) * 100;
              const altFut = (m.futuros / maxBarraMensal) * 100;
              return (
                <button
                  key={m.valor}
                  onClick={() => setMesSelecionado(m.valor)}
                  className={`flex flex-col items-center h-full justify-end p-2 rounded-xl border transition-all cursor-pointer ${
                    ativo
                      ? 'bg-slate-800/70 border-[#1D9E75]/60'
                      : 'bg-slate-950/40 border-transparent hover:border-slate-800'
                  }`}
                >
                  <span className="text-[11px] font-bold text-slate-200 mb-2">
                    {formatarPercentualBR(m.pct)}
                  </span>
                  <div className="w-12 sm:w-14 flex-1 flex flex-col justify-end gap-0.5">
                    {m.futuros > 0 && (
                      <div
                        style={{ height: `${Math.max(altFut, 10)}%` }}
                        className="w-full bg-emerald-500/60 rounded-t-md"
                      />
                    )}
                    {m.faltas > 0 && (
                      <div
                        style={{ height: `${Math.max(altFalta, 10)}%` }}
                        className="w-full bg-rose-400 rounded-sm"
                      />
                    )}
                    {m.realizados > 0 && (
                      <div
                        style={{ height: `${Math.max(altReal, 10)}%` }}
                        className="w-full bg-teal-400 rounded-b-md"
                      />
                    )}
                  </div>
                  <span className="text-xs font-semibold text-white mt-2">{m.curto}</span>
                  <span className="text-[10px] text-slate-400">{m.total} marc.</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-6 bg-slate-900/75 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col">
          <div className="mb-3.5">
            <h3 className="text-sm font-bold text-white">Absenteísmo por Procedimento</h3>
            <p className="text-xs text-slate-400">{labelPeriodoAtual}</p>
          </div>
          {rankingProcedimentos.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-xs text-slate-500 py-8 border border-dashed border-slate-800 rounded-xl">
              Sem agendamentos no período.
            </div>
          ) : (
            <div className="space-y-2.5 overflow-y-auto max-h-60 pr-1">
              {rankingProcedimentos.map((proc) => (
                <div
                  key={proc.id}
                  className="p-2.5 rounded-xl bg-slate-950/75 border border-slate-800/90 space-y-1.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-white truncate">{proc.nome}</p>
                      <p className="text-[11px] text-slate-400">
                        {proc.realizados} real. •{' '}
                        <span className={proc.faltas > 0 ? 'text-rose-300 font-medium' : ''}>
                          {proc.faltas} falta(s)
                        </span>
                        {proc.futuros > 0 ? ` • ${proc.futuros} fut.` : ''}
                      </p>
                    </div>
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-md border shrink-0 ${proc.faixa.bg} ${proc.faixa.text} ${proc.faixa.borda}`}
                    >
                      {formatarPercentualBR(proc.percentual)}
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-900 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${proc.faixa.barra}`}
                      style={{ width: `${Math.min(proc.percentual, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Pacientes Faltosos */}
      <div className="bg-slate-900/75 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-white">Pacientes Faltosos ({labelPeriodoAtual})</h3>
            <p className="text-xs text-slate-400">Clique no paciente para ver detalhes ou reagendar</p>
          </div>
          <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-rose-500/15 text-rose-300 border border-rose-500/35">
            {faltososPeriodo.length} registro(s)
          </span>
        </div>

        {faltososPeriodo.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            Nenhuma falta registrada neste período.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/70 text-[11px] uppercase tracking-wider text-slate-400">
                  <th className="py-3 px-4 font-semibold">Paciente</th>
                  <th className="py-3 px-4 font-semibold">Procedimento</th>
                  <th className="py-3 px-4 font-semibold">Data Perdida</th>
                  <th className="py-3 px-4 font-semibold">Motivo</th>
                  <th className="py-3 px-4 font-semibold text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70 text-sm">
                {faltososPeriodo.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => onVerDetalhes(item.id)}
                    className="hover:bg-slate-800/50 transition-colors cursor-pointer"
                  >
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-white text-xs sm:text-sm">
                          {item.nome_paciente}
                        </span>
                        <ReincidenteBadge totalFaltas={item.total_faltas} />
                      </div>
                      <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                        CNS: {formatarCNS(item.cns)}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-200">{item.procedimento_nome}</td>
                    <td className="py-3.5 px-4 text-xs text-slate-300">
                      {formatarAgendamentoResumo(item.data_agendamento, item.hora_agendamento)}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-rose-200 max-w-xs">
                      {item.motivo_falta || 'Não informado'}
                    </td>
                    <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => onReagendar(item.id)}
                        className="px-3 py-1.5 rounded-lg bg-[#085041] hover:bg-[#1D9E75] text-white text-xs font-semibold cursor-pointer"
                      >
                        Reagendar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}