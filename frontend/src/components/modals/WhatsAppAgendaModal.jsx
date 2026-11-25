import { useMemo, useState } from 'react';
import { X, MessageCircle, Copy, Check } from 'lucide-react';
import { somenteDigitos, formatarCNS, formatarCPF } from '../../utils/validarCNS';
import { isMenorDeIdade, formatarDataBR } from '../../utils/formatters';

function obterSaudacaoAtual() {
  const hora = new Date().getHours();
  if (hora < 12) return 'bom dia';
  if (hora < 18) return 'boa tarde';
  return 'boa noite';
}

export default function WhatsAppAgendaModal({
  agenda,
  slot,
  usuarioLogado,
  onFechar,
  onMarcarEnviado
}) {
  const menor = isMenorDeIdade(slot.data_nascimento);
  const primeiroNomeOperador = (usuarioLogado?.nome || 'Equipe').split(' ')[0];

  const mensagemPadrao = useMemo(() => {
    const saudacao = obterSaudacaoAtual();
    const dataBR = formatarDataBR(agenda.data_atendimento);
    const horario = slot.horario_slot || agenda.hora_inicio;
    const local = agenda.local_atendimento || 'PAM Salgadinho Sede';
    const docTexto = slot.cns
      ? `CNS: ${formatarCNS(slot.cns)}`
      : slot.cpf
        ? `CPF: ${formatarCPF(slot.cpf)}`
        : 'Documento não informado';

    if (menor) {
      const responsavel = slot.nome_responsavel || 'Responsável';
      return (
        `Olá, ${responsavel}, ${saudacao}, tudo bem? ` +
        `Me chamo ${primeiroNomeOperador}, faço parte da Regulação do Saúde da Gente Especialidade - ${local} ` +
        `e estou entrando em contato para confirmar a presença do(a) menor ${slot.nome_paciente} (${docTexto}) ` +
        `no atendimento com a profissional ${agenda.profissional_nome} no dia ${dataBR} às ${horario}.`
      );
    }

    return (
      `Olá, ${saudacao}, tudo bem? ` +
      `Me chamo ${primeiroNomeOperador}, faço parte da Regulação do Saúde da Gente Especialidade - ${local} ` +
      `e estou entrando em contato para confirmar a sua presença no atendimento com a profissional ` +
      `${agenda.profissional_nome} no dia ${dataBR} às ${horario}.`
    );
  }, [agenda, slot, menor, primeiroNomeOperador]);

  const [mensagem, setMensagem] = useState(mensagemPadrao);
  const [copiado, setCopiado] = useState(false);

  const telefoneDigitos = somenteDigitos(slot.telefone);
  const numeroWhatsApp =
    telefoneDigitos.length >= 10
      ? telefoneDigitos.startsWith('55')
        ? telefoneDigitos
        : `55${telefoneDigitos}`
      : null;

  function handleCopiar() {
    navigator.clipboard.writeText(mensagem);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  async function handleEnviarWhatsApp() {
    if (numeroWhatsApp) {
      window.open(
        `https://wa.me/${numeroWhatsApp}?text=${encodeURIComponent(mensagem)}`,
        '_blank',
        'noopener,noreferrer'
      );
    }
    await onMarcarEnviado();
    onFechar();
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onFechar}
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-emerald-400" />
              Aviso Individual via WhatsApp
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Paciente: <strong className="text-white">{slot.nome_paciente}</strong>
              {menor && (
                <span className="ml-2 px-1.5 py-0.5 rounded bg-[#C8963C]/20 text-[#f0cc82] text-[10px] font-bold">
                  Menor de idade
                </span>
              )}
            </p>
          </div>
          <button
            onClick={onFechar}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-300 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 space-y-1">
          <p>
            <span className="text-slate-500">Telefone:</span>{' '}
            <strong className="text-white">{slot.telefone || 'Não cadastrado'}</strong>
          </p>
          {menor && (
            <p>
              <span className="text-slate-500">Responsável Legal:</span>{' '}
              <strong className="text-[#f0cc82]">
                {slot.nome_responsavel || 'Não informado'}
              </strong>
            </p>
          )}
          <p>
            <span className="text-slate-500">Profissional / Horário:</span>{' '}
            <strong className="text-emerald-300">
              {agenda.profissional_nome} — {formatarDataBR(agenda.data_atendimento)} às{' '}
              {slot.horario_slot || agenda.hora_inicio}
            </strong>
          </p>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1.5">
            Mensagem (você pode revisar ou editar antes de enviar)
          </label>
          <textarea
            rows={6}
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs sm:text-sm text-white leading-relaxed focus:outline-none focus:border-[#1D9E75]"
          />
        </div>

        {!numeroWhatsApp && (
          <div className="p-2.5 rounded-lg bg-rose-500/15 border border-rose-500/40 text-xs text-rose-200">
            Este paciente não possui telefone válido cadastrado. Você ainda pode copiar a mensagem.
          </div>
        )}

        <div className="flex items-center justify-between gap-2 pt-2 flex-wrap">
          <button
            type="button"
            onClick={handleCopiar}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 cursor-pointer"
          >
            {copiado ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copiado ? 'Copiado!' : 'Copiar Texto'}
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onFechar}
              className="px-3.5 py-2 rounded-xl bg-slate-800 text-xs font-semibold text-slate-300 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleEnviarWhatsApp}
              disabled={!numeroWhatsApp}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer"
            >
              <MessageCircle className="w-4 h-4" />
              Abrir no WhatsApp e Confirmar Envio
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}