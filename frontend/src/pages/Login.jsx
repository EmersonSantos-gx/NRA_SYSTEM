import { useState } from 'react';
import { Shield, Lock } from 'lucide-react';

// Fallback seguro para funcionamento tanto no preview isolado quanto integrado ao AuthContext
let useAuthHook = null;
try {
  // Em projetos locais com AuthContext, utilize o import abaixo:
  // import { useAuth } from '../contexts/AuthContext';
} catch {
  useAuthHook = null;
}

export default function Login({ onLogin }) {
  const auth = typeof useAuthHook === 'function' ? useAuthHook() : null;

  // Campos iniciam vazios para exigir digitação manual das credenciais
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setErro('');
    setCarregando(true);
    try {
      if (auth?.login) {
        await auth.login(email, senha);
      } else if (onLogin) {
        await onLogin(email, senha);
      } else {
        const apiUrl = import.meta.env?.VITE_API_URL || 'http://localhost:3001/api';
        const resp = await fetch(`${apiUrl}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, senha })
        });
        const data = await resp.json();
        if (!resp.ok) {
          throw new Error(data?.erro || 'Credenciais inválidas.');
        }
        localStorage.setItem('regulasus_token', data.token);
        window.location.reload();
      }
    } catch (err) {
      setErro(err.response?.data?.erro || err.message || 'Não foi possível conectar ao servidor.');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-[#085041]/30 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-[#C8963C]/15 blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-7 sm:p-8 shadow-2xl relative z-10">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#085041] to-[#1D9E75] flex items-center justify-center shadow-lg border border-[#1D9E75]/50">
            <Shield className="w-6 h-6 text-[#f0cc82]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              Nucleo de Regulação Assistencial - NRA
            </h1>
            <p className="text-xs text-slate-400">
              Sistema de Acompanhamento, Absenteísmo e Tarefas
            </p>
          </div>
        </div>

        <div className="mb-5 p-3 rounded-xl bg-slate-950/75 border border-slate-800 text-xs text-slate-300 flex items-center gap-2.5">
          <Lock className="w-4 h-4 text-[#C8963C] shrink-0" />
          <span>Acesso exclusivo para administrativos autorizados.</span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              E-mail institucional
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu.email@institucional.gov.br"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#1D9E75]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Senha</label>
            <input
              type="password"
              required
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#1D9E75]"
            />
          </div>

          {erro && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-xs text-rose-200">
              {erro}
            </div>
          )}

          <button
            type="submit"
            disabled={carregando}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#085041] to-[#1D9E75] hover:from-[#0a6350] hover:to-[#22b586] disabled:opacity-60 text-white font-semibold text-sm shadow-lg transition-all cursor-pointer"
          >
            {carregando ? 'Autenticando...' : 'Entrar no Sistema'}
          </button>
        </form>
      </div>
    </div>
  );
}