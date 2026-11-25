import { useEffect, useState } from 'react';
import api from '../services/api';
import {
  somenteDigitos,
  validarCNS,
  classificarCNS,
  formatarCNS,
  gerarCNSValido,
  validarCPF,
  formatarCPF,
  gerarCPFValido
} from '../utils/validarCNS';
import { calcularIdade, isMenorDeIdade } from '../utils/formatters';
import { PRIORIDADE_CONFIG } from '../components/common/Badges';

export default function NovoAcompanhamento({ procedimentos, onSalvo, onCancelar }) {
  const ativos = procedimentos.filter((p) => p.ativo);
  const [tipoDoc, setTipoDoc] = useState('CNS'); // 'CNS' | 'CPF'
  const [cns, setCns] = useState('');
  const [cpf, setCpf] = useState('');
  const [removerCpfAoVincularCns, setRemoverCpfAoVincularCns] = useState(true);
  const [pacienteSemCnsEncontrado, setPacienteSemCnsEncontrado] = useState(false);

  const [prioridade, setPrioridade] = useState('NORMAL');
  const [nomePaciente, setNomePaciente] = useState('');
  const [nomeMae, setNomeMae] = useState('');
  const [nomeResponsavel, setNomeResponsavel] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [telefone, setTelefone] = useState('');
  const [procedimentoId, setProcedimentoId] = useState(ativos[0]?.id || '');
  const [observacoes, setObservacoes] = useState('');
  const [feedbackDoc, setFeedbackDoc] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  const cnsDigitos = somenteDigitos(cns);
  const cpfDigitos = somenteDigitos(cpf);
  const cnsValido = validarCNS(cnsDigitos);
  const cpfValido = validarCPF(cpfDigitos);

  const idade = calcularIdade(dataNascimento);
  const menor = isMenorDeIdade(dataNascimento);

  async function consultarNaBase(docDigitos) {
    setErro('');
    try {
      const { data } = await api.get(`/acompanhamentos/documento/${docDigitos}`);
      if (data.encontrado && data.paciente) {
        const p = data.paciente;
        setNomePaciente(p.nome_completo || '');
        setNomeMae(p.nome_mae || '');
        setNomeResponsavel(p.nome_responsavel || '');
        setDataNascimento(p.data_nascimento || '');
        setTelefone(p.telefone || '');

        if (p.cns) {
          setCns(formatarCNS(p.cns));
          setPacienteSemCnsEncontrado(false);
          setFeedbackDoc('Paciente localizado na base do Neon! Dados preenchidos automaticamente.');
        } else {
          setPacienteSemCnsEncontrado(true);
          setFeedbackDoc(
            'Paciente localizado pelo CPF provisório (ainda sem CNS). Se já tiver o CNS, informe abaixo para substituir e remover o CPF.'
          );
        }
      }
    } catch (err) {
      setPacienteSemCnsEncontrado(false);
      if (err.response?.status === 404) {
        setFeedbackDoc('Documento válido, ainda não cadastrado na base. Preencha os dados abaixo.');
      } else {
        setErro(err.response?.data?.erro || 'Erro ao consultar documento.');
      }
    }
  }

  // Busca automática ao completar 15 dígitos (CNS) ou 11 dígitos (CPF)
  useEffect(() => {
    if (tipoDoc === 'CNS' && cnsDigitos.length === 15 && cnsValido) {
      consultarNaBase(cnsDigitos);
    }
  }, [cnsDigitos, cnsValido, tipoDoc]);

  useEffect(() => {
    if (tipoDoc === 'CPF' && cpfDigitos.length === 11 && cpfValido) {
      consultarNaBase(cpfDigitos);
    }
  }, [cpfDigitos, cpfValido, tipoDoc]);

  async function handleSubmit(e) {
    e.preventDefault();
    setErro('');

    if (!cnsDigitos && !cpfDigitos) {
      return setErro('Informe o CNS ou o CPF do paciente.');
    }
    if (cnsDigitos && !cnsValido) {
      return setErro('CNS inválido pelo algoritmo Módulo 11.');
    }
    if (cpfDigitos && !cpfValido) {
      return setErro('CPF inválido.');
    }
    if (menor && !nomeResponsavel.trim()) {
      return setErro('Paciente menor de 18 anos exige o Nome do Responsável Legal.');
    }

    setSalvando(true);
    try {
      await api.post('/acompanhamentos', {
        cns: cnsDigitos || null,
        cpf: cpfDigitos || null,
        remover_cpf_ao_vincular_cns: removerCpfAoVincularCns,
        nome_paciente: nomePaciente.trim(),
        nome_mae: nomeMae.trim(),
        nome_responsavel: nomeResponsavel.trim(),
        data_nascimento: dataNascimento,
        telefone: telefone.trim(),
        procedimento_id: procedimentoId,
        prioridade,
        observacoes: observacoes.trim()
      });
      onSalvo(nomePaciente.trim());
    } catch (err) {
      setErro(err.response?.data?.erro || 'Erro ao cadastrar acompanhamento.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight">Novo Acompanhamento</h2>
        <p className="text-sm text-slate-400 mt-0.5">
          Identificação por CNS (padrão SUS) ou CPF provisório com busca automática no Neon.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-5 shadow-xl"
      >
        {/* Bloco de Identificação: CNS ou CPF */}
        <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="inline-flex bg-slate-900 border border-slate-800 rounded-xl p-1">
              <button
                type="button"
                onClick={() => {
                  setTipoDoc('CNS');
                  setFeedbackDoc('');
                }}
                className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                  tipoDoc === 'CNS'
                    ? 'bg-[#085041] text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                CNS (Padrão SUS)
              </button>
              <button
                type="button"
                onClick={() => {
                  setTipoDoc('CPF');
                  setFeedbackDoc('');
                }}
                className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                  tipoDoc === 'CPF'
                    ? 'bg-[#C8963C]/30 text-[#f0cc82]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                CPF (Provisório)
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                if (tipoDoc === 'CNS') setCns(formatarCNS(gerarCNSValido()));
                else setCpf(formatarCPF(gerarCPFValido()));
              }}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold text-slate-200 cursor-pointer"
            >
              Gerar {tipoDoc} válido (teste)
            </button>
          </div>

          {tipoDoc === 'CNS' ? (
            <div>
              <input
                type="text"
                value={cns}
                onChange={(e) => setCns(formatarCNS(e.target.value))}
                placeholder="000 0000 0000 0000"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm font-mono text-white focus:outline-none focus:border-[#1D9E75]"
              />
              {cnsDigitos.length > 0 && (
                <p className={`text-xs font-medium mt-1.5 ${cnsValido ? 'text-emerald-300' : 'text-rose-300'}`}>
                  {cnsValido
                    ? `✓ CNS válido (${classificarCNS(cnsDigitos)})`
                    : `CNS incompleto ou inválido (${cnsDigitos.length}/15 dígitos)`}
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <input
                  type="text"
                  value={cpf}
                  onChange={(e) => setCpf(formatarCPF(e.target.value))}
                  placeholder="000.000.000-00"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm font-mono text-white focus:outline-none focus:border-[#C8963C]"
                />
                {cpfDigitos.length > 0 && (
                  <p className={`text-xs font-medium mt-1.5 ${cpfValido ? 'text-emerald-300' : 'text-rose-300'}`}>
                    {cpfValido ? '✓ CPF válido (uso provisório)' : `CPF incompleto ou inválido (${cpfDigitos.length}/11 dígitos)`}
                  </p>
                )}
              </div>

              {pacienteSemCnsEncontrado && (
                <div className="p-3 rounded-xl bg-[#085041]/25 border border-[#1D9E75]/45 space-y-2">
                  <label className="block text-xs font-semibold text-emerald-300">
                    Vincular CNS agora (opcional — substitui o CPF):
                  </label>
                  <input
                    type="text"
                    value={cns}
                    onChange={(e) => setCns(formatarCNS(e.target.value))}
                    placeholder="Digite os 15 dígitos do CNS para substituir o CPF"
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono text-white"
                  />
                  <label className="inline-flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={removerCpfAoVincularCns}
                      onChange={(e) => setRemoverCpfAoVincularCns(e.target.checked)}
                      className="accent-[#1D9E75]"
                    />
                    Remover CPF do cadastro após vincular o CNS (LGPD)
                  </label>
                </div>
              )}
            </div>
          )}

          {feedbackDoc && (
            <div className="p-2.5 rounded-lg bg-[#1D9E75]/15 border border-[#1D9E75]/35 text-xs text-emerald-200">
              {feedbackDoc}
            </div>
          )}
        </div>

        {/* Dados do Paciente */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Nome completo do paciente *
            </label>
            <input
              type="text"
              required
              value={nomePaciente}
              onChange={(e) => setNomePaciente(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Data de nascimento *
            </label>
            <input
              type="date"
              required
              value={dataNascimento}
              onChange={(e) => setDataNascimento(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white"
            />
            {idade !== null && (
              <div className="mt-1.5 flex items-center gap-2">
                <span className="text-xs text-slate-400">Idade: {idade} anos</span>
                {menor && (
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-[#C8963C]/20 text-[#f0cc82] border border-[#C8963C]/45">
                    Menor de idade
                  </span>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Telefone / WhatsApp
            </label>
            <input
              type="text"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              placeholder="(82) 99999-0000"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Nome da mãe</label>
            <input
              type="text"
              value={nomeMae}
              onChange={(e) => setNomeMae(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Prioridade</label>
            <select
              value={prioridade}
              onChange={(e) => setPrioridade(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white"
            >
              {Object.entries(PRIORIDADE_CONFIG).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>

          <div
            className={`sm:col-span-2 p-3.5 rounded-xl border ${
              menor ? 'bg-[#C8963C]/15 border-[#C8963C]/60' : 'bg-slate-950/50 border-slate-800'
            }`}
          >
            <label className="block text-xs font-semibold text-slate-200 mb-1.5">
              Nome do responsável legal{' '}
              {menor ? (
                <span className="text-[#f0cc82]">* (Obrigatório para menor de 18 anos)</span>
              ) : (
                <span className="text-slate-500 font-normal">(opcional)</span>
              )}
            </label>
            <input
              type="text"
              required={menor}
              value={nomeResponsavel}
              onChange={(e) => setNomeResponsavel(e.target.value)}
              placeholder="Nome completo do pai, mãe ou tutor legal"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Procedimento solicitado *
            </label>
            <select
              required
              value={procedimentoId}
              onChange={(e) => setProcedimentoId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white"
            >
              {ativos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome} — {p.especialidade} ({p.codigo_sigtap})
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Observações</label>
            <textarea
              rows={3}
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white"
            />
          </div>
        </div>

        {erro && (
          <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-xs text-rose-200">
            {erro}
          </div>
        )}

        <div className="flex justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancelar}
            className="px-4 py-2.5 rounded-xl bg-slate-800 text-xs font-semibold text-slate-200 cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={salvando}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#085041] to-[#1D9E75] disabled:opacity-60 text-white text-xs font-semibold shadow-lg cursor-pointer"
          >
            {salvando ? 'Salvando...' : 'Cadastrar na Fila (Novo)'}
          </button>
        </div>
      </form>
    </div>
  );
}