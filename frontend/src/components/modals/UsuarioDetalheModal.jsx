import { useEffect, useState } from 'react';
import { X, User, Shield, CheckCircle2, Calendar, Activity, ClipboardList } from 'lucide-react';
import api from '../../services/api';
import { formatarDataBR, formatarDataHoraBR } from '../../utils/formatters';
import { InfoBloco } from '../common/Badges';

export default function UsuarioDetalheModal({ usuario, onFechar }) {
  const [acoes, setAcoes] = useState([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    setCarregando(true);
    api
      .get(`/usuarios/${usuario.id}/acoes`)
      .then(({ data }) => setAcoes(data))
      .catch(() => setAcoes([]))
      .finally(() => setCarregando(false));
  }, [usuario.id]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onFechar}
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-xl max-h-[88vh] flex flex-col overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white">{usuario.nome}</h3>
            <p className="text-xs text-slate-400">{usuario.cargo}</p>
          </div>
          <button
            onClick={onFechar}
            className="p-2 rounded-lg bg-slate-800 text-slate-300 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Corpo com Dados e Histórico */}
        <div className="p-6 overflow-y-auto space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <InfoBloco label="E-mail" valor={usuario.email} IconComponent={User} />
            <InfoBloco label="Perfil" valor={usuario.perfil} IconComponent={Shield} />
            <InfoBloco
              label="Status"
              valor={usuario.ativo ? 'Ativo' : 'Desativado'}
              IconComponent={CheckCircle2}
            />
            <InfoBloco
              label="Cadastrado em"
              valor={formatarDataBR(usuario.criado_em)}
              IconComponent={Calendar}
            />
          </div>

          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Log de Atividades ({acoes.length})
            </h4>

            {carregando ? (
              <p className="text-xs text-slate-500">Carregando log...</p>
            ) : acoes.length === 0 ? (
              <p className="text-xs text-slate-500">
                Nenhuma atividade registrada para este usuário.
              </p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {acoes.map((a) => (
                  <div
                    key={`${a.tipo}-${a.id}`}
                    className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1.5 font-semibold text-white">
                        {a.tipo === 'TAREFA' ? (
                          <ClipboardList className="w-3.5 h-3.5 text-[#C8963C]" />
                        ) : (
                          <Activity className="w-3.5 h-3.5 text-[#1D9E75]" />
                        )}
                        {a.referencia}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {formatarDataHoraBR(a.data_hora)}
                      </span>
                    </div>
                    <p className="text-slate-400">{a.descricao}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Rodapé */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/70 flex justify-end">
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
