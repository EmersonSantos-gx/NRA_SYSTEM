import {
  Shield,
  BarChart3,
  Activity,
  ClipboardList,
  UserPlus,
  CalendarDays,
  Stethoscope,
  Users,
  LogOut,
  X
} from 'lucide-react';

export default function Sidebar({
  usuario,
  abaAtiva,
  setAbaAtiva,
  badgeTarefas,
  menuMobileAberto,
  setMenuMobileAberto,
  onLogout
}) {
  const itens = [
    { id: 'dashboard', label: 'Dashboard', Icon: BarChart3 },
    { id: 'fila', label: 'Fila de Pacientes', Icon: Activity },
    { id: 'agenda', label: 'Agenda', Icon: CalendarDays },
    { id: 'tarefas', label: 'Tarefas', Icon: ClipboardList, badge: badgeTarefas },
    { id: 'novo', label: 'Novo Acompanhamento', Icon: UserPlus },
    { id: 'procedimentos', label: 'Procedimentos', Icon: Stethoscope },
    ...(usuario?.perfil === 'ADMIN'
      ? [{ id: 'usuarios', label: 'Usuários Autorizados', Icon: Users }]
      : [])
  ];

  return (
    <>
      {menuMobileAberto && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={() => setMenuMobileAberto(false)}
        />
      )}

      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-68 bg-slate-900/95 backdrop-blur-xl border-r border-slate-800 flex flex-col justify-between transition-transform duration-200 ${
          menuMobileAberto ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="p-5 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#085041] to-[#1D9E75] flex items-center justify-center border border-[#1D9E75]/50 shadow-md">
                <Shield className="w-5 h-5 text-[#f0cc82]" />
              </div>
              <div>
                <h1 className="text-base font-bold text-white leading-tight">RegulaSUS</h1>
                <p className="text-[11px] text-slate-400">Central de Regulação</p>
              </div>
            </div>
            <button
              onClick={() => setMenuMobileAberto(false)}
              className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="space-y-1.5">
            {itens.map(({ id, label, Icon, badge }) => {
              const ativa = abaAtiva === id;
              return (
                <button
                  key={id}
                  onClick={() => {
                    setAbaAtiva(id);
                    setMenuMobileAberto(false);
                  }}
                  className={`w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                    ativa
                      ? 'bg-gradient-to-r from-[#085041] to-[#1D9E75]/90 text-white border border-[#1D9E75]/50 shadow-md'
                      : 'text-slate-300 hover:bg-slate-800/80 hover:text-white border border-transparent'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${ativa ? 'text-[#f0cc82]' : 'text-[#1D9E75]'}`} />
                    <span>{label}</span>
                  </span>
                  {badge > 0 && (
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                        ativa
                          ? 'bg-[#C8963C] text-slate-950'
                          : 'bg-[#C8963C]/20 text-[#f0cc82] border border-[#C8963C]/45'
                      }`}
                    >
                      {badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-4 border-t border-slate-800">
          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white truncate">{usuario?.nome}</p>
              <p className="text-[10px] text-[#f0cc82] uppercase tracking-wider font-semibold">
                {usuario?.perfil === 'ADMIN' ? 'Coordenador (Admin)' : 'Colaborador'}
              </p>
            </div>
            <button
              onClick={onLogout}
              title="Sair"
              className="p-2 rounded-lg bg-slate-900 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 border border-slate-800 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
    