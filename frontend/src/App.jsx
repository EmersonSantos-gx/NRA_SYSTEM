import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import api from './services/api';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import FilaPacientes from './pages/FilaPacientes';
import Agenda from './pages/Agenda';
import Tarefas from './pages/Tarefas';
import NovoAcompanhamento from './pages/NovoAcompanhamento';
import Procedimentos from './pages/Procedimentos';
import Usuarios from './pages/Usuarios';

import Sidebar from './components/Layout/Sidebar';
import Header from './components/Layout/Header';
import PacienteDetalheModal from './components/modals/PacienteDetalheModal';
import TransicaoStatusModal from './components/modals/TransicaoStatusModal';
import UsuarioDetalheModal from './components/modals/UsuarioDetalheModal';

function SistemaAutenticado() {
  const { usuario, carregandoSessao, logout } = useAuth();
  const [abaAtiva, setAbaAtiva] = useState('dashboard');
  const [filtroStatusFila, setFiltroStatusFila] = useState('TODOS');
  const [menuMobileAberto, setMenuMobileAberto] = useState(false);

  // Estados sincronizados com a API (PostgreSQL Neon)
  const [acompanhamentos, setAcompanhamentos] = useState([]);
  const [procedimentos, setProcedimentos] = useState([]);
  const [tarefas, setTarefas] = useState([]);
  const [agendas, setAgendas] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [carregandoDados, setCarregandoDados] = useState(false);

  // Modais e notificações
  const [detalhePacienteId, setDetalhePacienteId] = useState(null);
  const [detalheUsuarioId, setDetalheUsuarioId] = useState(null);
  const [modalTransicao, setModalTransicao] = useState(null);
  const [toast, setToast] = useState(null);

  const notificar = useCallback((mensagem, tipo = 'sucesso') => {
    setToast({ mensagem, tipo });
    setTimeout(() => {
      setToast((atual) => (atual?.mensagem === mensagem ? null : atual));
    }, 3500);
  }, []);

  // Carrega todos os dados iniciais e após cada alteração
  const carregarDados = useCallback(async () => {
    if (!usuario) return;
    setCarregandoDados(true);
    try {
      const requisicoes = [
        api.get('/acompanhamentos'),
        api.get('/procedimentos'),
        api.get('/tarefas'),
        api.get('/agendas')
      ];
      if (usuario.perfil === 'ADMIN') {
        requisicoes.push(api.get('/usuarios'));
      }

      const resultados = await Promise.all(requisicoes);
      setAcompanhamentos(resultados[0].data);
      setProcedimentos(resultados[1].data);
      setTarefas(resultados[2].data);
      setAgendas(resultados[3].data);

      if (usuario.perfil === 'ADMIN' && resultados[4]) {
        setUsuarios(resultados[4].data);
      }
    } catch (err) {
      notificar(err.response?.data?.erro || 'Erro ao sincronizar dados com o Neon.', 'erro');
    } finally {
      setCarregandoDados(false);
    }
  }, [usuario, notificar]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  // Contador exibido na Sidebar para o coordenador ou colaborador
  const badgeTarefas = useMemo(() => {
    if (!usuario) return 0;
    if (usuario.perfil === 'ADMIN') {
      return tarefas.filter((t) => t.status === 'DEVOLVIDA').length;
    }
    return tarefas.filter((t) =>
      ['ATRIBUIDA', 'RECEBIDA', 'EM_ANDAMENTO'].includes(t.status)
    ).length;
  }, [tarefas, usuario]);

  async function handleAlternarAviso(id) {
    try {
      await api.patch(`/acompanhamentos/${id}/aviso`);
      await carregarDados();
    } catch {
      notificar('Erro ao atualizar confirmação de aviso.', 'erro');
    }
  }

  async function handleConfirmarComparecimento(id) {
    try {
      await api.patch(`/acompanhamentos/${id}/status`, { status_destino: 'REALIZADO' });
      await carregarDados();
      notificar('Procedimento marcado como Realizado.');
    } catch {
      notificar('Erro ao confirmar comparecimento.', 'erro');
    }
  }

  async function handleExecutarTransicao(payload) {
    try {
      await api.patch(`/acompanhamentos/${modalTransicao.id}/status`, payload);
      setModalTransicao(null);
      await carregarDados();
      notificar('Status atualizado com sucesso.');
    } catch (err) {
      notificar(err.response?.data?.erro || 'Erro ao atualizar status.', 'erro');
    }
  }

  if (carregandoSessao) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-sm text-slate-400">
        Verificando sessão...
      </div>
    );
  }

  if (!usuario) return <Login />;

  const pacienteSelecionado = acompanhamentos.find((a) => a.id === detalhePacienteId) || null;
  const usuarioSelecionado = usuarios.find((u) => u.id === detalheUsuarioId) || null;
  const pacienteTransicao = modalTransicao
    ? acompanhamentos.find((a) => a.id === modalTransicao.id)
    : null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      <Sidebar
        usuario={usuario}
        abaAtiva={abaAtiva}
        setAbaAtiva={setAbaAtiva}
        badgeTarefas={badgeTarefas}
        menuMobileAberto={menuMobileAberto}
        setMenuMobileAberto={setMenuMobileAberto}
        onLogout={logout}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <Header
          abaAtiva={abaAtiva}
          usuario={usuario}
          onAbrirMenu={() => setMenuMobileAberto(true)}
        />

        <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto">
          {carregandoDados && acompanhamentos.length === 0 ? (
            <div className="text-center py-16 text-sm text-slate-400">
              Carregando dados do PostgreSQL (Neon)...
            </div>
          ) : (
            <>
              {abaAtiva === 'dashboard' && (
                <Dashboard
                  acompanhamentos={acompanhamentos}
                  onIrParaFila={(st) => {
                    setFiltroStatusFila(st);
                    setAbaAtiva('fila');
                  }}
                  onVerDetalhes={setDetalhePacienteId}
                  onReagendar={(id) => setModalTransicao({ id, statusDestino: 'MARCADO' })}
                  onNotificar={notificar}
                />
              )}

              {abaAtiva === 'fila' && (
                <FilaPacientes
                  acompanhamentos={acompanhamentos}
                  procedimentos={procedimentos}
                  filtroStatusInicial={filtroStatusFila}
                  onNovoAcompanhamento={() => setAbaAtiva('novo')}
                  onVerDetalhes={setDetalhePacienteId}
                  onAlternarAviso={handleAlternarAviso}
                  onConfirmarComparecimento={handleConfirmarComparecimento}
                  onIniciarTransicao={(id, statusDestino) =>
                    setModalTransicao({ id, statusDestino })
                  }
                  onNotificar={notificar}
                />
              )}

              {abaAtiva === 'agenda' && (
                <Agenda
                  agendas={agendas}
                  procedimentos={procedimentos}
                  acompanhamentos={acompanhamentos}
                  usuarioLogado={usuario}
                  onRecarregar={carregarDados}
                  onNotificar={notificar}
                />
              )}

              {abaAtiva === 'tarefas' && (
                <Tarefas
                  tarefas={tarefas}
                  usuarios={usuarios}
                  usuarioLogado={usuario}
                  onRecarregar={carregarDados}
                  onNotificar={notificar}
                />
              )}

              {abaAtiva === 'novo' && (
                <NovoAcompanhamento
                  procedimentos={procedimentos}
                  onSalvo={async (nome) => {
                    await carregarDados();
                    setFiltroStatusFila('NOVO');
                    setAbaAtiva('fila');
                    notificar(`Paciente ${nome} cadastrado no Neon.`);
                  }}
                  onCancelar={() => setAbaAtiva('fila')}
                />
              )}

              {abaAtiva === 'procedimentos' && (
                <Procedimentos
                  procedimentos={procedimentos}
                  onRecarregar={carregarDados}
                  onNotificar={notificar}
                />
              )}

              {abaAtiva === 'usuarios' && usuario.perfil === 'ADMIN' && (
                <Usuarios
                  usuarios={usuarios}
                  usuarioLogado={usuario}
                  onRecarregar={carregarDados}
                  onVerDetalhes={setDetalheUsuarioId}
                  onNotificar={notificar}
                />
              )}
            </>
          )}
        </main>
      </div>

      {pacienteSelecionado && (
        <PacienteDetalheModal
          paciente={pacienteSelecionado}
          usuarioLogado={usuario}
          colaboradores={usuarios.filter((u) => u.ativo && u.id !== usuario.id)}
          onFechar={() => setDetalhePacienteId(null)}
          onAtualizado={carregarDados}
          onAlternarAviso={() => handleAlternarAviso(pacienteSelecionado.id)}
          onConfirmarComparecimento={() => {
            handleConfirmarComparecimento(pacienteSelecionado.id);
            setDetalhePacienteId(null);
          }}
          onIniciarTransicao={(statusDestino) => {
            setDetalhePacienteId(null);
            setModalTransicao({ id: pacienteSelecionado.id, statusDestino });
          }}
          onNotificar={notificar}
        />
      )}

      {modalTransicao && pacienteTransicao && (
        <TransicaoStatusModal
          paciente={pacienteTransicao}
          statusDestino={modalTransicao.statusDestino}
          onFechar={() => setModalTransicao(null)}
          onConfirmar={handleExecutarTransicao}
        />
      )}

      {usuarioSelecionado && (
        <UsuarioDetalheModal
          usuario={usuarioSelecionado}
          onFechar={() => setDetalheUsuarioId(null)}
        />
      )}

      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-50 px-4 py-3 rounded-xl shadow-2xl border text-xs font-semibold flex items-center gap-2.5 ${
            toast.tipo === 'erro'
              ? 'bg-rose-950/95 border-rose-500/50 text-rose-100'
              : 'bg-slate-900/95 border-[#1D9E75]/60 text-emerald-100'
          }`}
        >
          {toast.tipo === 'erro' ? (
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-[#1D9E75]" />
          )}
          {toast.mensagem}
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <SistemaAutenticado />
    </AuthProvider>
  );
}
