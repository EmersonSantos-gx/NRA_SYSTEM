import { Menu } from 'lucide-react';

const TITULOS = {
  dashboard: {
    titulo: 'Dashboard de Absenteísmo',
    sub: 'Indicadores de agendamentos, comparecimentos, faltas e absenteísmo real'
  },
  fila: {
    titulo: 'Fila de Pacientes',
    sub: 'Gestão completa do ciclo clínico, SLA de espera, WhatsApp e registro de faltas'
  },
  tarefas: {
    titulo: 'Tarefas Privadas',
    sub: 'Atribuição exclusiva por colaborador com devolução ao coordenador'
  },
  novo: {
    titulo: 'Novo Acompanhamento',
    sub: 'Validação de CNS (Módulo 11) e regra legal para menores de idade'
  },
  procedimentos: {
    titulo: 'Procedimentos (SIGTAP)',
    sub: 'Catálogo padronizado de exames e consultas'
  },
  usuarios: {
    titulo: 'Usuários Autorizados',
    sub: 'Gestão de acessos da equipe (ADMIN)'
  },
  agenda: {
  titulo: 'Agenda por Profissional',
  sub: 'Gestão de vagas (slots), alocação de pacientes e confirmação individual via WhatsApp'
}
};

export default function Header({ abaAtiva, usuario, onAbrirMenu }) {
  const info = TITULOS[abaAtiva] || { titulo: 'RegulaSUS', sub: '' };

  return (
    <header className="sticky top-0 z-30 bg-slate-950/85 backdrop-blur-md border-b border-slate-800 px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onAbrirMenu}
          className="lg:hidden p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 cursor-pointer"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="min-w-0">
          <h2 className="text-sm sm:text-base font-bold text-white truncate">{info.titulo}</h2>
          <p className="hidden sm:block text-xs text-slate-400 truncate">{info.sub}</p>
        </div>
      </div>

      <span className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 shrink-0">
        <span className="w-2 h-2 rounded-full bg-emerald-400" />
        {usuario?.cargo}
      </span>
    </header>
  );
}