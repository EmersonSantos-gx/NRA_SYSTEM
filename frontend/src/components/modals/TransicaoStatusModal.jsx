import { useState } from 'react';
import { X } from 'lucide-react';

export default function TransicaoStatusModal({ paciente, statusDestino, onFechar, onConfirmar }) {
  const [motivoPendencia, setMotivoPendencia] = useState(paciente.motivo_pendencia || '');
  const [motivoFalta, setMotivoFalta] = useState('');
  const [dataAgendamento, setDataAgendamento] = useState(paciente.data_agendamento || '');
  const [horaAgendamento, setHoraAgendamento] = useState(paciente.hora_agendamento || '08:30');
  const [localAgendamento, setLocalAgendamento] = useState(
    paciente.local_agendamento || 'Policlínica Central'
  );

  function handleSubmit(e) {
    e.preventDefault();
    onConfirmar({
      status_destino: statusDestino,
      motivo_pendencia: motivoPendencia.trim(),
      motivo_falta: motivoFalta.trim(),
      data_agendamento: dataAgendamento,
      hora_agendamento: horaAgendamento,
      local_agendamento: localAgendamento.trim()
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onFechar}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-white">
            {statusDestino === 'PENDENTE' && 'Registrar Pendência'}
            {statusDestino === 'MARCADO' && 'Agendar Procedimento'}
            {statusDestino === 'FALTOU' && 'Registrar Falta do Paciente'}
          </h3>
          <button
            type="button"
            onClick={onFechar}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-300 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-slate-400">
          Paciente: <strong className="text-white">{paciente.nome_paciente}</strong>
        </p>

        {statusDestino === 'PENDENTE' && (
          <div>
            <label className="block text-xs text-slate-300 mb-1.5">Motivo da pendência *</label>
            <textarea
              rows={3}
              required
              value={motivoPendencia}
              onChange={(e) => setMotivoPendencia(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white"
            />
          </div>
        )}

        {statusDestino === 'FALTOU' && (
          <div>
            <label className="block text-xs text-slate-300 mb-1.5">Motivo da falta *</label>
            <textarea
              rows={3}
              required
              value={motivoFalta}
              onChange={(e) => setMotivoFalta(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white"
            />
          </div>
        )}

        {statusDestino === 'MARCADO' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-300 mb-1">Data *</label>
                <input
                  type="date"
                  required
                  value={dataAgendamento}
                  onChange={(e) => setDataAgendamento(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1">Horário</label>
                <input
                  type="time"
                  value={horaAgendamento}
                  onChange={(e) => setHoraAgendamento(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-300 mb-1">Local de atendimento *</label>
              <input
                type="text"
                required
                value={localAgendamento}
                onChange={(e) => setLocalAgendamento(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white"
              />
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onFechar}
            className="px-4 py-2 rounded-xl bg-slate-800 text-xs font-semibold text-slate-300 cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#085041] to-[#1D9E75] text-white text-xs font-semibold cursor-pointer"
          >
            Confirmar
          </button>
        </div>
      </form>
    </div>
  );
}