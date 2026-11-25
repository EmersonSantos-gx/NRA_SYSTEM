import { useState } from 'react';
import api from '../services/api';

export default function Procedimentos({ procedimentos, onRecarregar, onNotificar }) {
  const [nome, setNome] = useState('');
  const [codigoSigtap, setCodigoSigtap] = useState('');
  const [especialidade, setEspecialidade] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!nome.trim() || !especialidade.trim()) return;
    try {
      await api.post('/procedimentos', {
        nome: nome.trim(),
        codigo_sigtap: codigoSigtap.trim(),
        especialidade: especialidade.trim()
      });
      setNome('');
      setCodigoSigtap('');
      setEspecialidade('');
      await onRecarregar();
      onNotificar('Procedimento cadastrado.');
    } catch (err) {
      onNotificar(err.response?.data?.erro || 'Erro ao cadastrar procedimento.', 'erro');
    }
  }

  async function handleAlternar(id) {
    try {
      await api.patch(`/procedimentos/${id}/status`);
      await onRecarregar();
    } catch {
      onNotificar('Erro ao atualizar status.', 'erro');
    }
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleSubmit}
        className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 grid grid-cols-1 sm:grid-cols-4 gap-3.5 items-end"
      >
        <div className="sm:col-span-2">
          <label className="block text-xs text-slate-300 mb-1">Nome do procedimento *</label>
          <input
            type="text"
            required
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-300 mb-1">Código SIGTAP</label>
          <input
            type="text"
            value={codigoSigtap}
            onChange={(e) => setCodigoSigtap(e.target.value)}
            placeholder="02.06.02.003-1"
            className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm font-mono text-white"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-300 mb-1">Especialidade *</label>
          <input
            type="text"
            required
            value={especialidade}
            onChange={(e) => setEspecialidade(e.target.value)}
            className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white"
          />
        </div>
        <div className="sm:col-span-4 flex justify-end">
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#085041] to-[#1D9E75] text-white text-xs font-semibold cursor-pointer"
          >
            + Adicionar Procedimento
          </button>
        </div>
      </form>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {procedimentos.map((p) => (
          <div
            key={p.id}
            className="bg-slate-900/75 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between gap-3"
          >
            <div>
              <div className="flex items-start justify-between gap-2">
                <span className="text-[11px] font-mono text-[#1D9E75]">{p.codigo_sigtap}</span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    p.ativo ? 'bg-emerald-500/15 text-emerald-300' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {p.ativo ? 'Ativo' : 'Inativo'}
                </span>
              </div>
              <h3 className="text-sm font-bold text-white mt-1.5">{p.nome}</h3>
              <p className="text-xs text-slate-400 mt-0.5">{p.especialidade}</p>
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-slate-800 text-xs">
              <span className="text-slate-400">{p.total_pacientes || 0} paciente(s)</span>
              <button
                onClick={() => handleAlternar(p.id)}
                className="text-xs font-semibold text-slate-300 hover:text-white cursor-pointer"
              >
                {p.ativo ? 'Desativar' : 'Reativar'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}