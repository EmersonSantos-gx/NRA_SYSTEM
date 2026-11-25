import { somenteDigitos } from './validarCNS';

export function calcularIdade(dataNascimento) {
  if (!dataNascimento) return null;
  const partes = String(dataNascimento).slice(0, 10).split('-');
  if (partes.length !== 3) return null;
  const ano = parseInt(partes[0], 10);
  const mes = parseInt(partes[1], 10) - 1;
  const dia = parseInt(partes[2], 10);
  const hoje = new Date();
  let idade = hoje.getFullYear() - ano;
  const m = hoje.getMonth() - mes;
  if (m < 0 || (m === 0 && hoje.getDate() < dia)) idade--;
  return idade >= 0 ? idade : null;
}

export function isMenorDeIdade(dataNascimento) {
  const idade = calcularIdade(dataNascimento);
  return idade !== null && idade < 18;
}

export function calcularDiasEspera(criadoEm) {
  if (!criadoEm) return 0;
  const inicio = new Date(criadoEm);
  if (Number.isNaN(inicio.getTime())) return 0;
  const diffMs = Date.now() - inicio.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

export function formatarDataBR(dataISO) {
  if (!dataISO) return '—';
  const partes = String(dataISO).slice(0, 10).split('-');
  if (partes.length !== 3) return dataISO;
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

export function formatarDataHoraBR(isoString) {
  if (!isoString) return '—';
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return isoString;
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function formatarAgendamentoResumo(data, hora) {
  if (!data) return 'Sem agendamento';
  return hora ? `${formatarDataBR(data)} às ${hora}` : formatarDataBR(data);
}

export function formatarPercentualBR(valor) {
  return `${Number(valor || 0).toFixed(1).replace('.', ',')}%`;
}

export function obterFaixaAbsenteismo(pct) {
  if (pct < 15) {
    return {
      label: 'Controlado',
      bg: 'bg-emerald-500/15',
      text: 'text-emerald-300',
      borda: 'border-emerald-400/40',
      barra: 'bg-emerald-400'
    };
  }
  if (pct <= 25) {
    return {
      label: 'Atenção',
      bg: 'bg-[#C8963C]/20',
      text: 'text-[#f0cc82]',
      borda: 'border-[#C8963C]/45',
      barra: 'bg-[#C8963C]'
    };
  }
  return {
    label: 'Crítico',
    bg: 'bg-rose-500/15',
    text: 'text-rose-300',
    borda: 'border-rose-400/45',
    barra: 'bg-rose-400'
  };
}

export function montarLinkWhatsApp(paciente) {
  const fone = somenteDigitos(paciente.telefone);
  if (fone.length < 10) return null;
  const numero = fone.startsWith('55') ? fone : `55${fone}`;
  const texto = `Olá, ${paciente.nome_paciente}! Confirmamos seu agendamento pelo SUS:\n• Procedimento: ${
    paciente.procedimento_nome || 'Exame/Consulta'
  }\n• Data: ${formatarDataBR(paciente.data_agendamento)}${
    paciente.hora_agendamento ? ` às ${paciente.hora_agendamento}` : ''
  }\n• Local: ${
    paciente.local_agendamento || 'Unidade de Referência'
  }\n\nPor favor, responda SIM para confirmar seu comparecimento.`;
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}

export function exportarParaCSV(nomeArquivo, cabecalhos, linhas) {
  const escapar = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const conteudo = [
    cabecalhos.map(escapar).join(';'),
    ...linhas.map((linha) => linha.map(escapar).join(';'))
  ].join('\r\n');

  const blob = new Blob(['\uFEFF' + conteudo], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', nomeArquivo);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}