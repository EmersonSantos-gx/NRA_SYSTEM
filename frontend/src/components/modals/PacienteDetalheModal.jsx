import { useState } from 'react';
import {
  X,
  Edit3,
  ClipboardList,
  Calendar,
  Phone,
  User,
  UserX,
  Stethoscope,
  Clock,
  FileText,
  MessageCircle
} from 'lucide-react';
import api from '../../services/api';
import {
  formatarCNS,
  classificarCNS,
  formatarCPF,
  validarCNS,
  somenteDigitos
} from '../../utils/validarCNS';
import {
  calcularIdade,
  isMenorDeIdade,
  formatarDataBR,
  formatarDataHoraBR,
  formatarAgendamentoResumo,
  montarLinkWhatsApp
} from '../../utils/formatters';
import {
  PRIORIDADE_CONFIG,
  StatusBadge,
  PrioridadeBadge,
  ReincidenteBadge,
  InfoBloco
} from '../common/Badges';

export default function PacienteDetalheModal({
  paciente,
  usuarioLogado,
  colaboradores,
  onFechar,
  onAtualizado,
  onAlternarAviso,
  onConfirmarComparecimento,
  onIniciarTransicao,
  onNotificar
}) {
  const [editando, setEditando] = useState(false);
  const [atribuindo, setAtribuindo] = useState(false);
  const [tituloTarefa, setTituloTarefa] = useState('');
  const [colabId, setColabId] = useState(colaboradores[0]?.id || '');

  const [cnsInput, setCnsInput] = useState(paciente.cns ? formatarCNS(paciente.cns) : '');
  const [removerCpf, setRemoverCpf] = useState(true);
  const [telefone, setTelefone] = useState(paciente.telefone || '');
  const [prioridade, setPrioridade] = useState(paciente.prioridade || 'NORMAL');
  const [nomeResponsavel, setNomeResponsavel] = useState(paciente.nome_responsavel || '');
  const [observacoes, setObservacoes] = useState(paciente.observacoes || '');
  const [erro, setErro] = useState('');

  const idade = calcularIdade(paciente.data_nascimento);
  const menor = isMenorDeIdade(paciente.data_nascimento);
  const linkWpp = paciente.status === 'MARCADO' ? montarLinkWhatsApp(paciente) : null;

  async function handleSalvarEdicao(e) {
    e.preventDefault();
    if (menor && !nomeResponsavel.trim()) {
      return setErro('Paciente menor de 18 anos exige Responsável Legal.');
    }

    const cnsLimpo = somenteDigitos(cnsInput);
    if (cnsLimpo && !validarCNS(cnsLimpo)) {
      return setErro('O CNS informado é inválido pelo algoritmo Módulo 11.');
    }

    try {
      await api.put(`/acompanhamentos/${paciente.id}`, {
        cns: cnsLimpo || null,
        remover_cpf: removerCpf,
        telefone,
        prioridade,
        nome_responsavel: nomeResponsavel,
        observacoes
      });
      setEditando(false);
      setErro('');
      await onAtualizado();
      onNotificar('Cadastro atualizado e registrado na auditoria LGPD.');
    } catch (err) {
      setErro(err.response?.data?.erro || 'Erro ao salvar alterações.');
    }
  }

  async function handleCriarTarefa(e) {
    e.preventDefault();
    const alvo = colabId || colaboradores[0]?.id;
    if (!tituloTarefa.trim() || !alvo) return;
    const docTexto = paciente.cns
      ? `CNS ${formatarCNS(paciente.cns)}`
      : `CPF ${formatarCPF(paciente.cpf)}`;
    try {
      await api.post('/tarefas', {
        titulo: tituloTarefa.trim(),
        descricao: `Tarefa vinculada ao paciente ${paciente.nome_paciente} (${docTexto}).`,
        acompanhamento_id: paciente.id,
        colaborador_id: alvo,
        prioridade: paciente.prioridade === 'URGENCIA' ? 'URGENCIA' : 'NORMAL'
      });
      setTituloTarefa('');
      setAtribuindo(false);
      await onAtualizado();
      onNotificar('Tarefa privada enviada ao colaborador.');
    } catch (err) {
      onNotificar(err.response?.data?.erro || 'Erro ao atribuir tarefa.', 'erro');
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onFechar}
    >
      <div
        className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70 gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-lg font-bold text-white">{paciente.nome_paciente}</h3>
              <StatusBadge status={paciente.status} />
              <PrioridadeBadge prioridade={paciente.prioridade} />
              <ReincidenteBadge totalFaltas={paciente.total_faltas} />
            </div>
            <p className="text-xs font-mono text-slate-400 mt-1">
              {paciente.cns ? (
                <>
                  CNS: {formatarCNS(paciente.cns)} ({classificarCNS(paciente.cns)})
                </>
              ) : (
                <span className="text-[#f0cc82]">
                  CPF Provisório: {formatarCPF(paciente.cpf)} — Aguardando vínculo de CNS
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {usuarioLogado?.perfil === 'ADMIN' && !editando && colaboradores.length > 0 && (
              <button
                onClick={() => setAtribuindo((v) => !v)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#085041] text-xs font-semibold text-emerald-100 border border-[#1D9E75]/50 cursor-pointer"
              >
                <ClipboardList className="w-3.5 h-3.5" /> Tarefa
              </button>
            )}
            {!editando && (
              <button
                onClick={() => setEditando(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 text-xs font-semibold text-[#f0cc82] border border-[#C8963C]/40 cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" /> Editar
              </button>
            )}
            <button
              onClick={onFechar}
              className="p-2 rounded-lg bg-slate-800 text-slate-300 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto space-y-5">
          {atribuindo && (
            <form
              onSubmit={handleCriarTarefa}
              className="p-4 rounded-xl bg-[#085041]/25 border border-[#1D9E75]/50 space-y-3"
            >
              <p className="text-xs font-bold uppercase text-emerald-300">
                Atribuir Tarefa Privada sobre este Paciente
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  required
                  value={tituloTarefa}
                  onChange={(e) => setTituloTarefa(e.target.value)}
                  placeholder="O que o colaborador deve executar?"
                  className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white"
                />
                <select
                  value={colabId || colaboradores[0]?.id || ''}
                  onChange={(e) => setColabId(e.target.value)}
                  className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white"
                >
                  {colaboradores.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nome}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAtribuindo(false)}
                  className="px-3 py-1.5 rounded-lg text-xs bg-slate-800 text-slate-300 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[#1D9E75] text-white cursor-pointer"
                >
                  Enviar
                </button>
              </div>
            </form>
          )}

          {editando ? (
            <form
              onSubmit={handleSalvarEdicao}
              className="space-y-4 bg-slate-950/70 p-4 rounded-xl border border-[#C8963C]/40"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="sm:col-span-2 p-3 rounded-xl bg-slate-900 border border-[#1D9E75]/40 space-y-2">
                  <label className="block text-xs font-semibold text-emerald-300">
                    Cartão Nacional de Saúde (CNS — 15 dígitos)
                  </label>
                  <input
                    type="text"
                    value={cnsInput}
                    onChange={(e) => setCnsInput(formatarCNS(e.target.value))}
                    placeholder="000 0000 0000 0000"
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm font-mono text-white"
                  />
                  {paciente.cpf && (
                    <label className="inline-flex items-center gap-2 text-xs text-[#f0cc82] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={removerCpf}
                        onChange={(e) => setRemoverCpf(e.target.checked)}
                        className="accent-[#1D9E75]"
                      />
                      Remover CPF ({formatarCPF(paciente.cpf)}) definitivamente após vincular o CNS (LGPD)
                    </label>
                  )}
                </div>

                <div>
                  <label className="block text-xs text-slate-300 mb-1">Telefone</label>
                  <input
                    type="text"
                    value={telefone}
                    onChange={(e) => setTelefone(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Prioridade</label>
                  <select
                    value={prioridade}
                    onChange={(e) => setPrioridade(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-white"
                  >
                    {Object.entries(PRIORIDADE_CONFIG).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs text-slate-300 mb-1">
                    Responsável Legal {menor ? '* (Obrigatório)' : ''}
                  </label>
                  <input
                    type="text"
                    value={nomeResponsavel}
                    onChange={(e) => setNomeResponsavel(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-white"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs text-slate-300 mb-1">Observações</label>
                  <textarea
                    rows={2}
                    value={observacoes}
                    onChange={(e) => setObservacoes(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-white"
                  />
                </div>
              </div>
              {erro && <p className="text-xs text-rose-400">{erro}</p>}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditando(false)}
                  className="px-3.5 py-1.5 rounded-lg text-xs bg-slate-800 text-slate-200 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-[#1D9E75] text-white cursor-pointer"
                >
                  Salvar Alterações
                </button>
              </div>
            </form>
          ) : (
            <>
              {(menor || paciente.nome_responsavel) && (
                <div className="p-3.5 rounded-xl bg-[#C8963C]/15 border border-[#C8963C]/50">
                  <p className="text-[11px] font-semibold uppercase text-[#f0cc82]">
                    Responsável Legal {menor ? '(Obrigatório — Menor de 18 anos)' : ''}
                  </p>
                  <p className="text-sm font-semibold text-white mt-0.5">
                    {paciente.nome_responsavel || 'Não informado'}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <InfoBloco
                  label="Nascimento / Idade"
                  valor={`${formatarDataBR(paciente.data_nascimento)}${
                    idade !== null ? ` (${idade} anos)` : ''
                  }`}
                  IconComponent={Calendar}
                />
                <InfoBloco label="Telefone" valor={paciente.telefone} IconComponent={Phone} />
                <InfoBloco label="Nome da Mãe" valor={paciente.nome_mae} IconComponent={User} />
                <InfoBloco
                  label="Faltas Acumuladas"
                  valor={`${paciente.total_faltas || 0} falta(s)`}
                  IconComponent={UserX}
                />
                <InfoBloco
                  label="Procedimento"
                  valor={`${paciente.procedimento_nome} (${paciente.codigo_sigtap})`}
                  IconComponent={Stethoscope}
                />
                <InfoBloco
                  label="Última Atualização"
                  valor={formatarDataHoraBR(paciente.atualizado_em)}
                  IconComponent={Clock}
                />
              </div>

              {paciente.data_agendamento && (
                <div className="p-4 rounded-xl bg-[#085041]/25 border border-[#1D9E75]/45 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-bold uppercase text-emerald-300">Agendamento</p>
                    <p className="text-sm font-semibold text-white mt-0.5">
                      {formatarAgendamentoResumo(
                        paciente.data_agendamento,
                        paciente.hora_agendamento
                      )}{' '}
                      — {paciente.local_agendamento}
                    </p>
                  </div>
                  {paciente.status === 'MARCADO' && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={onAlternarAviso}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${
                          paciente.aviso_confirmado
                            ? 'bg-emerald-500/20 text-emerald-200 border-emerald-400/50'
                            : 'bg-slate-900 text-slate-300 border-slate-700'
                        }`}
                      >
                        {paciente.aviso_confirmado ? '✓ Aviso Confirmado' : 'Marcar Aviso'}
                      </button>
                      {linkWpp && (
                        <a
                          href={linkWpp}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold"
                        >
                          <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                        </a>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-[#1D9E75]" /> Histórico de Auditoria (LGPD)
            </h4>
            <div className="space-y-2.5">
              {(paciente.historico || []).map((h) => (
                <div
                  key={h.id}
                  className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-white">{h.usuarioNome}</span>
                    <span className="text-[11px] text-slate-500">
                      {formatarDataHoraBR(h.dataHora)}
                    </span>
                  </div>
                  <p className="text-slate-300 mt-1">{h.observacao}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/70 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            {(paciente.status === 'NOVO' || paciente.status === 'PENDENTE') && (
              <>
                <button
                  onClick={() => onIniciarTransicao('PENDENTE')}
                  className="px-3 py-1.5 rounded-lg bg-[#C8963C]/20 text-[#f0cc82] border border-[#C8963C]/40 text-xs font-semibold cursor-pointer"
                >
                  Registrar Pendência
                </button>
                <button
                  onClick={() => onIniciarTransicao('MARCADO')}
                  className="px-3.5 py-1.5 rounded-lg bg-[#085041] text-white text-xs font-semibold cursor-pointer"
                >
                  Agendar
                </button>
              </>
            )}
            {paciente.status === 'MARCADO' && (
              <>
                <button
                  onClick={onConfirmarComparecimento}
                  className="px-3.5 py-1.5 rounded-lg bg-teal-600 text-white text-xs font-semibold cursor-pointer"
                >
                  Confirmar Realizado
                </button>
                <button
                  onClick={() => onIniciarTransicao('FALTOU')}
                  className="px-3.5 py-1.5 rounded-lg bg-rose-500/20 text-rose-200 border border-rose-500/40 text-xs font-semibold cursor-pointer"
                >
                  Registrar Falta
                </button>
              </>
            )}
            {paciente.status === 'FALTOU' && (
              <button
                onClick={() => onIniciarTransicao('MARCADO')}
                className="px-3.5 py-1.5 rounded-lg bg-[#085041] text-white text-xs font-semibold cursor-pointer"
              >
                Reagendar
              </button>
            )}
          </div>
          <button
            onClick={onFechar}
            className="px-4 py-1.5 rounded-lg bg-slate-800 text-xs font-semibold text-slate-200 cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
