import { useMemo, useState } from 'react';
import {
  Lock,
  Send,
  Calendar,
  CheckCircle2,
  Check,
  Clock,
  Eye,
  Play,
  Paperclip,
  Download
} from 'lucide-react';
import api from '../services/api';
import { formatarDataBR, formatarDataHoraBR } from '../utils/formatters';
import { STATUS_TAREFA_CONFIG, PrioridadeBadge } from '../components/common/Badges';

const MAX_ANEXO_MB = 5;

export default function Tarefas({
  tarefas,
  usuarios,
  usuarioLogado,
  onRecarregar,
  onNotificar
}) {
  const isCoordenador = usuarioLogado?.perfil === 'ADMIN';
  const colaboradores = useMemo(
    () => usuarios.filter((u) => u.ativo && u.id !== usuarioLogado.id),
    [usuarios, usuarioLogado.id]
  );

  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [colaboradorId, setColaboradorId] = useState(colaboradores[0]?.id || '');
  const [prioridade, setPrioridade] = useState('NORMAL');
  const [prazo, setPrazo] = useState('');

  const [filtroAba, setFiltroAba] = useState(isCoordenador ? 'DEVOLVIDA' : 'ABERTAS');
  const [finalizandoId, setFinalizandoId] = useState(null);
  const [parecer, setParecer] = useState('');
  const [anexo, setAnexo] = useState(null); // { nome, tipo, base64 }

  const contadores = useMemo(
    () => ({
      ABERTAS: tarefas.filter((t) => ['ATRIBUIDA', 'RECEBIDA', 'EM_ANDAMENTO'].includes(t.status))
        .length,
      DEVOLVIDA: tarefas.filter((t) => t.status === 'DEVOLVIDA').length,
      CONCLUIDA: tarefas.filter((t) => t.status === 'CONCLUIDA').length
    }),
    [tarefas]
  );

  const filtradas = useMemo(() => {
    if (filtroAba === 'ABERTAS') {
      return tarefas.filter((t) => ['ATRIBUIDA', 'RECEBIDA', 'EM_ANDAMENTO'].includes(t.status));
    }
    return tarefas.filter((t) => t.status === filtroAba);
  }, [tarefas, filtroAba]);

  async function handleCriar(e) {
    e.preventDefault();
    const colabAlvo = colaboradorId || colaboradores[0]?.id;
    if (!titulo.trim() || !colabAlvo) return;
    try {
      await api.post('/tarefas', {
        titulo: titulo.trim(),
        descricao: descricao.trim(),
        colaborador_id: colabAlvo,
        prioridade,
        prazo: prazo || null
      });
      setTitulo('');
      setDescricao('');
      setPrioridade('NORMAL');
      setFiltroAba('ABERTAS');
      await onRecarregar();
      onNotificar('Tarefa distribuída ao colaborador.');
    } catch (err) {
      onNotificar(err.response?.data?.erro || 'Erro ao distribuir tarefa.', 'erro');
    }
  }

  async function handleReceber(tarefaId) {
    try {
      await api.patch(`/tarefas/${tarefaId}/receber`);
      await onRecarregar();
      onNotificar('Recebimento confirmado e notificado ao coordenador.');
    } catch (err) {
      onNotificar(err.response?.data?.erro || 'Erro ao confirmar recebimento.', 'erro');
    }
  }

  async function handleIniciar(tarefaId) {
    try {
      await api.patch(`/tarefas/${tarefaId}/iniciar`);
      await onRecarregar();
      onNotificar('Tarefa marcada como Em Andamento.');
    } catch (err) {
      onNotificar(err.response?.data?.erro || 'Erro ao iniciar tarefa.', 'erro');
    }
  }

  function handleSelecionarAnexo(e) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) {
      setAnexo(null);
      return;
    }
    if (arquivo.size > MAX_ANEXO_MB * 1024 * 1024) {
      onNotificar(`O anexo deve ter no máximo ${MAX_ANEXO_MB}MB.`, 'erro');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setAnexo({
        nome: arquivo.name,
        tipo: arquivo.type || 'application/octet-stream',
        base64: reader.result
      });
    };
    reader.readAsDataURL(arquivo);
  }

  async function handleDevolver(tarefaId) {
    if (!parecer.trim()) return;
    try {
      await api.patch(`/tarefas/${tarefaId}/devolver`, {
        parecer_colaborador: parecer.trim(),
        anexo_nome: anexo?.nome || null,
        anexo_tipo: anexo?.tipo || null,
        anexo_base64: anexo?.base64 || null
      });
      setFinalizandoId(null);
      setParecer('');
      setAnexo(null);
      await onRecarregar();
      onNotificar('Devolutiva enviada ao coordenador com sucesso.');
    } catch (err) {
      onNotificar(err.response?.data?.erro || 'Erro ao enviar devolutiva.', 'erro');
    }
  }

  async function handleConcluir(tarefaId) {
    try {
      await api.patch(`/tarefas/${tarefaId}/concluir`);
      await onRecarregar();
      onNotificar('Tarefa validada e concluída.');
    } catch (err) {
      onNotificar(err.response?.data?.erro || 'Erro ao concluir tarefa.', 'erro');
    }
  }

  async function handleReabrir(tarefaId) {
    try {
      await api.patch(`/tarefas/${tarefaId}/reabrir`, {
        motivo: 'Solicitada revisão complementar pela coordenação.'
      });
      await onRecarregar();
      onNotificar('Tarefa reenviada ao colaborador.');
    } catch (err) {
      onNotificar(err.response?.data?.erro || 'Erro ao reabrir tarefa.', 'erro');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">
            {isCoordenador ? 'Distribuição de Tarefas da Equipe' : 'Minhas Tarefas'}
          </h2>
          <p className="text-sm text-slate-400 mt-0.5">
            {isCoordenador
              ? 'Distribua demandas diretamente para cada colaborador e acompanhe recebimento, início e devolutiva com anexo.'
              : 'Confirme o recebimento, avise quando iniciar e envie a devolutiva resolvida (com anexo se necessário).'}
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 self-start">
          <Lock className="w-3.5 h-3.5 text-[#C8963C]" />
          Visibilidade privada por colaborador
        </span>
      </div>

      {/* Formulário do Coordenador (sem vínculo com paciente) */}
      {isCoordenador && (
        <form
          onSubmit={handleCriar}
          className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl"
        >
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#f0cc82]">
            <Send className="w-3.5 h-3.5 text-[#C8963C]" /> Distribuir Nova Tarefa
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="md:col-span-2">
              <label className="block text-xs text-slate-300 mb-1.5">Título da tarefa *</label>
              <input
                type="text"
                required
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Ex: Organizar planilhas de retorno da semana..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1.5">Colaborador *</label>
              <select
                required
                value={colaboradorId || colaboradores[0]?.id || ''}
                onChange={(e) => setColaboradorId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white"
              >
                {colaboradores.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nome} ({u.cargo})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1.5">Prazo</label>
              <input
                type="date"
                value={prazo}
                onChange={(e) => setPrazo(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white"
              />
            </div>

            <div className="md:col-span-2 lg:col-span-3">
              <label className="block text-xs text-slate-300 mb-1.5">
                Descrição / Instruções da demanda
              </label>
              <textarea
                rows={2}
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Detalhe o que precisa ser resolvido pelo colaborador..."
                className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white"
              />
            </div>

            <div className="flex flex-col justify-between gap-2">
              <div>
                <label className="block text-xs text-slate-300 mb-1.5">Prioridade</label>
                <select
                  value={prioridade}
                  onChange={(e) => setPrioridade(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white"
                >
                  <option value="NORMAL">Normal</option>
                  <option value="URGENCIA">Urgência</option>
                </select>
              </div>
              <button
                type="submit"
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#085041] to-[#1D9E75] text-white text-xs font-semibold cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" /> Enviar Tarefa
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Abas */}
      <div className="flex items-center gap-2 flex-wrap">
        {[
          {
            id: isCoordenador ? 'DEVOLVIDA' : 'ABERTAS',
            label: isCoordenador
              ? `Devolvidas para validação (${contadores.DEVOLVIDA})`
              : `Em aberto / Execução (${contadores.ABERTAS})`
          },
          {
            id: isCoordenador ? 'ABERTAS' : 'DEVOLVIDA',
            label: isCoordenador
              ? `Com colaboradores (${contadores.ABERTAS})`
              : `Enviadas ao Coordenador (${contadores.DEVOLVIDA})`
          },
          { id: 'CONCLUIDA', label: `Concluídas (${contadores.CONCLUIDA})` }
        ].map((aba) => (
          <button
            key={aba.id}
            onClick={() => setFiltroAba(aba.id)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold border cursor-pointer ${
              filtroAba === aba.id
                ? 'bg-[#085041]/40 text-emerald-200 border-[#1D9E75]/60'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
            }`}
          >
            {aba.label}
          </button>
        ))}
      </div>

      {/* Lista */}
      {filtradas.length === 0 ? (
        <div className="bg-slate-900/60 border border-dashed border-slate-800 rounded-2xl p-10 text-center text-sm text-slate-500">
          Nenhuma tarefa nesta categoria.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtradas.map((t) => {
            const st = STATUS_TAREFA_CONFIG[t.status] || STATUS_TAREFA_CONFIG.ATRIBUIDA;
            return (
              <div
                key={t.id}
                className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between gap-4 shadow-lg"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${st.bg} ${st.text} ${st.border}`}
                      >
                        {st.label}
                      </span>
                      <PrioridadeBadge prioridade={t.prioridade} />
                    </div>
                    {t.prazo && (
                      <span className="text-[11px] text-slate-400 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-[#1D9E75]" />
                        Prazo: {formatarDataBR(t.prazo)}
                      </span>
                    )}
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-white">{t.titulo}</h3>
                    {t.descricao && (
                      <p className="text-xs text-slate-300 mt-1.5 whitespace-pre-line">
                        {t.descricao}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 rounded-xl bg-slate-950/75 border border-slate-800">
                      <span className="text-[10px] uppercase text-slate-500 block">Coordenador</span>
                      <span className="font-semibold text-[#f0cc82]">{t.coordenador_nome}</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-950/75 border border-slate-800">
                      <span className="text-[10px] uppercase text-slate-500 block">Colaborador</span>
                      <span className="font-semibold text-emerald-300">{t.colaborador_nome}</span>
                    </div>
                  </div>

                  {/* Linha do tempo da tarefa */}
                  <div className="flex flex-wrap gap-3 text-[11px] text-slate-400">
                    <span>Enviada: {formatarDataHoraBR(t.criado_em)}</span>
                    {t.recebido_em && (
                      <span className="text-sky-300">
                        • Recebida: {formatarDataHoraBR(t.recebido_em)}
                      </span>
                    )}
                    {t.iniciado_em && (
                      <span className="text-indigo-300">
                        • Iniciada: {formatarDataHoraBR(t.iniciado_em)}
                      </span>
                    )}
                  </div>

                  {/* Devolutiva e Anexo */}
                  {t.parecer_colaborador && (
                    <div className="p-3 rounded-xl bg-[#C8963C]/10 border border-[#C8963C]/35 text-xs space-y-2">
                      <p className="font-semibold text-[#f0cc82] uppercase text-[10px]">
                        Devolutiva de {t.colaborador_nome} ({formatarDataHoraBR(t.finalizado_em)})
                      </p>
                      <p className="text-slate-100 whitespace-pre-line">{t.parecer_colaborador}</p>

                      {t.anexo_base64 && (
                        <div className="pt-1">
                          <a
                            href={t.anexo_base64}
                            download={t.anexo_nome || 'anexo'}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-emerald-300 hover:text-emerald-200 font-semibold"
                          >
                            <Download className="w-3.5 h-3.5" />
                            Baixar anexo: {t.anexo_nome}
                          </a>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Rodapé de Ações */}
                <div className="pt-3 border-t border-slate-800">
                  {!isCoordenador && ['ATRIBUIDA', 'RECEBIDA', 'EM_ANDAMENTO'].includes(t.status) && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        {t.status === 'ATRIBUIDA' && (
                          <button
                            onClick={() => handleReceber(t.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500/20 text-sky-200 border border-sky-400/40 text-xs font-semibold cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" /> Avisar que Recebi
                          </button>
                        )}

                        {(t.status === 'ATRIBUIDA' || t.status === 'RECEBIDA') && (
                          <button
                            onClick={() => handleIniciar(t.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/20 text-indigo-200 border border-indigo-400/40 text-xs font-semibold cursor-pointer"
                          >
                            <Play className="w-3.5 h-3.5" /> Avisar que Iniciei
                          </button>
                        )}

                        {finalizandoId !== t.id && (
                          <button
                            onClick={() => {
                              setFinalizandoId(t.id);
                              setParecer('');
                              setAnexo(null);
                            }}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-[#085041] to-[#1D9E75] text-white text-xs font-semibold cursor-pointer ml-auto"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" /> Enviar Devolutiva
                          </button>
                        )}
                      </div>

                      {finalizandoId === t.id && (
                        <div className="p-3 rounded-xl bg-slate-950/90 border border-[#1D9E75]/50 space-y-2.5">
                          <label className="block text-[11px] font-semibold text-emerald-300">
                            Devolutiva (Problema resolvido / Resumo da entrega) *
                          </label>
                          <textarea
                            rows={3}
                            value={parecer}
                            onChange={(e) => setParecer(e.target.value)}
                            placeholder="Descreva a resolução da tarefa..."
                            className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                          />

                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <label className="inline-flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer bg-slate-900 border border-slate-700 px-3 py-1.5 rounded-lg hover:border-slate-500">
                              <Paperclip className="w-3.5 h-3.5 text-[#C8963C]" />
                              <span>
                                {anexo ? anexo.nome : `Anexar arquivo (opcional, até ${MAX_ANEXO_MB}MB)`}
                              </span>
                              <input
                                type="file"
                                onChange={handleSelecionarAnexo}
                                className="hidden"
                              />
                            </label>

                            <div className="flex items-center gap-2 justify-end">
                              <button
                                type="button"
                                onClick={() => {
                                  setFinalizandoId(null);
                                  setAnexo(null);
                                }}
                                className="px-3 py-1.5 rounded-lg text-xs bg-slate-800 text-slate-300 cursor-pointer"
                              >
                                Cancelar
                              </button>
                              <button
                                type="button"
                                disabled={!parecer.trim()}
                                onClick={() => handleDevolver(t.id)}
                                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[#1D9E75] text-white disabled:opacity-50 cursor-pointer"
                              >
                                Devolver ao Coordenador
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {isCoordenador && t.status === 'DEVOLVIDA' && (
                    <div className="flex justify-end gap-2 flex-wrap">
                      <button
                        onClick={() => handleReabrir(t.id)}
                        className="px-3 py-1.5 rounded-lg text-xs bg-slate-800 text-slate-200 cursor-pointer"
                      >
                        Reenviar ao Colaborador
                      </button>
                      <button
                        onClick={() => handleConcluir(t.id)}
                        className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" /> Validar e Concluir
                      </button>
                    </div>
                  )}

                  {!isCoordenador && t.status === 'DEVOLVIDA' && (
                    <p className="text-[11px] text-[#f0cc82] flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" /> Aguardando validação de {t.coordenador_nome}.
                    </p>
                  )}

                  {isCoordenador && ['ATRIBUIDA', 'RECEBIDA', 'EM_ANDAMENTO'].includes(t.status) && (
                    <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-sky-400" />
                      Status atual com {t.colaborador_nome}: <strong className="text-slate-200">{st.label}</strong>.
                    </p>
                  )}

                  {t.status === 'CONCLUIDA' && (
                    <p className="text-[11px] text-emerald-300 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Concluída em{' '}
                      {formatarDataHoraBR(t.concluido_em)}.
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