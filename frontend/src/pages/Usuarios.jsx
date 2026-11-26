import { useState } from 'react';
import { Edit3, KeyRound, History, Trash2, Power } from 'lucide-react';
import api from '../services/api';

export default function Usuarios({
  usuarios,
  usuarioLogado,
  onRecarregar,
  onVerDetalhes,
  onNotificar
}) {
  // 1. Estados do formulário de criação de novo usuário
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [cargo, setCargo] = useState('');
  const [perfil, setPerfil] = useState('OPERADOR');
  const [senha, setSenha] = useState('');

  // 2. Estados do modal de edição cadastral
  const [usuarioEditando, setUsuarioEditando] = useState(null);
  const [editNome, setEditNome] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editCargo, setEditCargo] = useState('');
  const [editPerfil, setEditPerfil] = useState('OPERADOR');

  // 3. Estados do modal de redefinição de senha
  const [usuarioSenha, setUsuarioSenha] = useState(null);
  const [novaSenha, setNovaSenha] = useState('');

  // Cadastrar novo usuário autorizado
  async function handleCadastrar(e) {
    e.preventDefault();
    try {
      await api.post('/usuarios', { nome, email, cargo, perfil, senha });
      setNome('');
      setEmail('');
      setCargo('');
      setSenha('');
      await onRecarregar();
      onNotificar('Usuário autorizado criado com sucesso.');
    } catch (err) {
      onNotificar(err.response?.data?.erro || 'Erro ao criar usuário.', 'erro');
    }
  }

  // Abrir modal de edição preenchido
  function abrirModalEdicao(usuario) {
    setUsuarioEditando(usuario);
    setEditNome(usuario.nome);
    setEditEmail(usuario.email);
    setEditCargo(usuario.cargo || '');
    setEditPerfil(usuario.perfil);
  }

  // Salvar alterações do usuário
  async function handleSalvarEdicao(e) {
    e.preventDefault();
    if (!usuarioEditando) return;
    try {
      await api.put(`/usuarios/${usuarioEditando.id}`, {
        nome: editNome,
        email: editEmail,
        cargo: editCargo,
        perfil: editPerfil
      });
      setUsuarioEditando(null);
      await onRecarregar();
      onNotificar('Dados do usuário atualizados com sucesso.');
    } catch (err) {
      onNotificar(err.response?.data?.erro || 'Erro ao editar usuário.', 'erro');
    }
  }

  // Salvar nova senha
  async function handleSalvarSenha(e) {
    e.preventDefault();
    if (!usuarioSenha || !novaSenha.trim()) return;
    try {
      await api.patch(`/usuarios/${usuarioSenha.id}/senha`, { nova_senha: novaSenha });
      setUsuarioSenha(null);
      setNovaSenha('');
      onNotificar(`Senha de ${usuarioSenha.nome} alterada com sucesso.`);
    } catch (err) {
      onNotificar(err.response?.data?.erro || 'Erro ao alterar senha.', 'erro');
    }
  }

  // Ativar ou desativar acesso
  async function handleAlternarStatus(usuario) {
    try {
      await api.patch(`/usuarios/${usuario.id}/status`);
      await onRecarregar();
      onNotificar(`Acesso de ${usuario.nome} ${usuario.ativo ? 'desativado' : 'reativado'}.`);
    } catch (err) {
      onNotificar(err.response?.data?.erro || 'Erro ao atualizar status.', 'erro');
    }
  }

  // Excluir usuário permanentemente
  async function handleExcluir(usuario) {
    const confirmou = window.confirm(
      `Tem certeza que deseja excluir permanentemente o usuário "${usuario.nome}"?`
    );
    if (!confirmou) return;

    try {
      await api.delete(`/usuarios/${usuario.id}`);
      await onRecarregar();
      onNotificar(`Usuário ${usuario.nome} excluído.`);
    } catch (err) {
      onNotificar(err.response?.data?.erro || 'Erro ao excluir usuário.', 'erro');
    }
  }

  return (
    <div className="space-y-6">
      {/* BLOCO 1: Formulário de Novo Acesso */}
      <form
        onSubmit={handleCadastrar}
        className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end shadow-xl"
      >
        <div>
          <label className="block text-xs text-slate-300 mb-1">Nome *</label>
          <input
            type="text"
            required
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Nome completo"
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
            placeholder="email@institucional.gov.br"
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
            minLength={4}
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="Mín. 4 caracteres"
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
          + Autorizar Acesso
        </button>
      </form>

      {/* BLOCO 2: Tabela de Usuários Cadastrados */}
      <div className="bg-slate-900/75 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="px-5 py-3.5 border-b border-slate-800 text-xs text-slate-400">
          Gerencie edição, redefinição de senha, log de atividades e exclusão de acessos.
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/70 text-[11px] uppercase text-slate-400">
                <th className="py-3 px-4 font-semibold">Profissional</th>
                <th className="py-3 px-4 font-semibold">Perfil</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold">Atividades</th>
                <th className="py-3 px-4 font-semibold text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70 text-xs sm:text-sm">
              {usuarios.map((u) => {
                const ehProprio = u.id === usuarioLogado.id;
                return (
                  <tr key={u.id} className="hover:bg-slate-800/40">
                    <td className="py-3.5 px-4">
                      <p className="font-semibold text-white">
                        {u.nome}{' '}
                        {ehProprio && (
                          <span className="text-[10px] text-emerald-400 font-normal">(Você)</span>
                        )}
                      </p>
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
                      <span
                        className={
                          u.ativo ? 'text-emerald-300 font-semibold' : 'text-rose-300 font-semibold'
                        }
                      >
                        {u.ativo ? 'Ativo' : 'Desativado'}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-xs text-slate-300">
                      {u.total_movimentacoes || 0} registro(s)
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center justify-end gap-1.5 flex-wrap">
                        <button
                          onClick={() => onVerDetalhes(u.id)}
                          title="Log de Atividade"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-sky-300 border border-slate-700 cursor-pointer"
                        >
                          <History className="w-3.5 h-3.5" /> Log
                        </button>

                        <button
                          onClick={() => abrirModalEdicao(u)}
                          title="Editar Usuário"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-[#f0cc82] border border-slate-700 cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" /> Editar
                        </button>

                        <button
                          onClick={() => {
                            setUsuarioSenha(u);
                            setNovaSenha('');
                          }}
                          title="Alterar Senha"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-emerald-300 border border-slate-700 cursor-pointer"
                        >
                          <KeyRound className="w-3.5 h-3.5" /> Senha
                        </button>

                        {!ehProprio && (
                          <>
                            <button
                              onClick={() => handleAlternarStatus(u)}
                              title={u.ativo ? 'Desativar acesso' : 'Reativar acesso'}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer"
                            >
                              <Power className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => handleExcluir(u)}
                              title="Excluir Usuário"
                              className="p-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* BLOCO 3: Modal de Edição de Usuário */}
      {usuarioEditando && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setUsuarioEditando(null)}
        >
          <form
            onSubmit={handleSalvarEdicao}
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl"
          >
            <h3 className="text-base font-bold text-white">Editar Usuário Autorizado</h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-300 mb-1">Nome completo *</label>
                <input
                  type="text"
                  required
                  value={editNome}
                  onChange={(e) => setEditNome(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-300 mb-1">E-mail institucional *</label>
                <input
                  type="email"
                  required
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-300 mb-1">Cargo</label>
                <input
                  type="text"
                  value={editCargo}
                  onChange={(e) => setEditCargo(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-300 mb-1">Perfil</label>
                <select
                  value={editPerfil}
                  onChange={(e) => setEditPerfil(e.target.value)}
                  disabled={usuarioEditando.id === usuarioLogado.id}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white disabled:opacity-60"
                >
                  <option value="OPERADOR">Colaborador (OPERADOR)</option>
                  <option value="ADMIN">Coordenador (ADMIN)</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setUsuarioEditando(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-xs font-semibold text-slate-300 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-[#1D9E75] text-white text-xs font-semibold cursor-pointer"
              >
                Salvar Alterações
              </button>
            </div>
          </form>
        </div>
      )}

      {/* BLOCO 4: Modal de Redefinição de Senha */}
      {usuarioSenha && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setUsuarioSenha(null)}
        >
          <form
            onSubmit={handleSalvarSenha}
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-2xl"
          >
            <div>
              <h3 className="text-base font-bold text-white">Alterar Senha</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Usuário: <strong className="text-white">{usuarioSenha.nome}</strong>
              </p>
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">Nova senha *</label>
              <input
                type="password"
                required
                minLength={4}
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                placeholder="Digite a nova senha (mín. 4 caracteres)"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setUsuarioSenha(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-xs font-semibold text-slate-300 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-[#1D9E75] text-white text-xs font-semibold cursor-pointer"
              >
                Redefinir Senha
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}