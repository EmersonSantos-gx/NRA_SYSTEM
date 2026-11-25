import { AlertTriangle } from 'lucide-react';

export const STATUS_CONFIG = {
  NOVO: {
    label: 'Novo',
    bg: 'bg-sky-500/15',
    text: 'text-sky-300',
    border: 'border-sky-400/35',
    dot: 'bg-sky-400'
  },
  PENDENTE: {
    label: 'Pendente',
    bg: 'bg-[#C8963C]/20',
    text: 'text-[#f0cc82]',
    border: 'border-[#C8963C]/45',
    dot: 'bg-[#C8963C]'
  },
  MARCADO: {
    label: 'Marcado',
    bg: 'bg-[#1D9E75]/20',
    text: 'text-emerald-300',
    border: 'border-[#1D9E75]/45',
    dot: 'bg-[#1D9E75]'
  },
  REALIZADO: {
    label: 'Realizado',
    bg: 'bg-teal-500/15',
    text: 'text-teal-200',
    border: 'border-teal-400/40',
    dot: 'bg-teal-300'
  },
  FALTOU: {
    label: 'Faltou',
    bg: 'bg-rose-500/15',
    text: 'text-rose-300',
    border: 'border-rose-400/45',
    dot: 'bg-rose-400'
  }
};

export const PRIORIDADE_CONFIG = {
  NORMAL: { label: 'Normal', bg: 'bg-slate-800', text: 'text-slate-300', border: 'border-slate-700' },
  URGENCIA: { label: 'Urgência', bg: 'bg-rose-500/20', text: 'text-rose-300', border: 'border-rose-400/50' },
  IDOSO: { label: 'Idoso 60+', bg: 'bg-amber-500/15', text: 'text-amber-200', border: 'border-amber-400/40' },
  GESTANTE: { label: 'Gestante', bg: 'bg-fuchsia-500/15', text: 'text-fuchsia-200', border: 'border-fuchsia-400/40' },
  PCD: { label: 'PCD', bg: 'bg-indigo-500/15', text: 'text-indigo-200', border: 'border-indigo-400/40' }
};

export const STATUS_TAREFA_CONFIG = {
  ATRIBUIDA: {
    label: 'Aguardando Recebimento',
    bg: 'bg-slate-800',
    text: 'text-slate-200',
    border: 'border-slate-700'
  },
  RECEBIDA: {
    label: 'Recebida',
    bg: 'bg-sky-500/15',
    text: 'text-sky-300',
    border: 'border-sky-400/35'
  },
  EM_ANDAMENTO: {
    label: 'Em Andamento',
    bg: 'bg-indigo-500/15',
    text: 'text-indigo-200',
    border: 'border-indigo-400/40'
  },
  DEVOLVIDA: {
    label: 'Devolvida ao Coordenador',
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

export function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.NOVO;
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

export function PrioridadeBadge({ prioridade }) {
  const cfg = PRIORIDADE_CONFIG[prioridade] || PRIORIDADE_CONFIG.NORMAL;
  return (
    <span className={`inline-flex items-center text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      {cfg.label}
    </span>
  );
}

export function ReincidenteBadge({ totalFaltas }) {
  if (!totalFaltas || totalFaltas < 2) return null;
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-200 border border-rose-400/50">
      <AlertTriangle className="w-3 h-3" />
      Reincidente ({totalFaltas}x)
    </span>
  );
}

export function InfoBloco({ label, valor, IconComponent }) {
  return (
    <div className="p-3 rounded-xl bg-slate-950/75 border border-slate-800/90">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
        {IconComponent && <IconComponent className="w-3.5 h-3.5 text-[#1D9E75]" />}
        {label}
      </div>
      <div className="text-xs sm:text-sm font-medium text-white mt-1 break-words">
        {valor || '—'}
      </div>
    </div>
  );
}