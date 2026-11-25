import { useState } from 'react';
import api from '../services/api';

export default function Usuarios({
  usuarios,
  usuarioLogado,
  onRecarregar,
  onVerDetalhes,
  onNotificar
}) {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [cargo, setCargo] = useState('');
  const [perfil, setPerfil] = useState('OPERADOR');
  const [senha, setSenha] = useState('123456');

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      await api.post('/usuarios', { nome, email, cargo, perfil, senha });
      setNome('');
      setEmail('');
      setCargo('');
      setSenha('123456');
      await onRecarregar();
      onNotificar('Usuário autorizado criado com sucesso.');
    } catch (err) {
      onNotificar(err.response?.data?.erro || 'Erro ao criar usuário.', 'erro');
    }
  }

  async function handleAlternar(id) {
    try {
      await api.patch(`/usuarios/${id}/status`);
      await onRecarregar();
      onNotificar('Status do usuário atualizado.');
    } catch (err) {
      onNotificar(err.response?.data?.erro || 'Erro ao atualizar status.', 'erro');
    }
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleSubmit}
        className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end"
      >
        <div>
          <label className="block text-xs text-slate-300 mb-1">Nome *</label>
          <input
            type="text"
            required
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-300 mb-1">E-mail *</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-300 mb-1">Cargo</label>
          <input
            type="text"
            value={cargo}
            onChange={(e) => setCargo(e.target.value)}
            placeholder="Técnico em Regulação"
            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-300 mb-1">Senha inicial *</label>
          <input
            type="password"
            required
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-300 mb-1">Perfil</label>
          <select
            value={perfil}
            onChange={(e) => setPerfil(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
          >
            <option value="OPERADOR">Colaborador</option>
            <option value="ADMIN">Coordenador (Admin)</option>
          </select>
        </div>
        <button
          type="submit"
          className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#085041] to-[#1D9E75] text-white text-xs font-semibold cursor-pointer"
        >
          Autorizar
        </button>
      </form>

      <div className="bg-slate-900/75 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-800 text-xs text-slate-400">
          Clique em um usuário para ver detalhes e movimentações de auditoria.
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/70 text-[11px] uppercase text-slate-400">
                <th className="py-3 px-4 font-semibold">Profissional</th>
                <th className="py-3 px-4 font-semibold">Perfil</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold">Auditoria</th>
                <th className="py-3 px-4 font-semibold text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70 text-xs sm:text-sm">
              {usuarios.map((u) => (
                <tr
                  key={u.id}
                  onClick={() => onVerDetalhes(u.id)}
                  className="hover:bg-slate-800/50 cursor-pointer"
                >
                  <td className="py-3.5 px-4">
                    <p className="font-semibold text-white">{u.nome}</p>
                    <p className="text-[11px] text-slate-400">
                      {u.email} • {u.cargo}
                    </p>
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                        u.perfil === 'ADMIN'
                          ? 'bg-[#C8963C]/20 text-[#f0cc82] border-[#C8963C]/45'
                          : 'bg-sky-500/15 text-sky-300 border-sky-400/35'
                      }`}
                    >
                      {u.perfil}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className={u.ativo ? 'text-emerald-300 font-semibold' : 'text-rose-300 font-semibold'}>
                      {u.ativo ? 'Ativo' : 'Desativado'}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-xs text-slate-300">
                    {u.total_movimentacoes || 0} ação(ões)
                  </td>
                  <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                    {u.id !== usuarioLogado.id && (
                      <button
                        onClick={() => handleAlternar(u.id)}
                        className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 cursor-pointer"
                      >
                        {u.ativo ? 'Desativar' : 'Ativar'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}