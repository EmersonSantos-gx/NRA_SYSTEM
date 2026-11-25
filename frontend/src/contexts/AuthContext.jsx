import { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [carregandoSessao, setCarregandoSessao] = useState(true);

  useEffect(() => {
    async function restaurarSessao() {
      const token = localStorage.getItem('regulasus_token');
      if (!token) {
        setCarregandoSessao(false);
        return;
      }
      try {
        const { data } = await api.get('/auth/me');
        setUsuario(data.usuario);
      } catch {
        localStorage.removeItem('regulasus_token');
        setUsuario(null);
      } finally {
        setCarregandoSessao(false);
      }
    }

    restaurarSessao();

    const onForcedLogout = () => setUsuario(null);
    window.addEventListener('regulasus:logout', onForcedLogout);
    return () => window.removeEventListener('regulasus:logout', onForcedLogout);
  }, []);

  async function login(email, senha) {
    const { data } = await api.post('/auth/login', { email, senha });
    localStorage.setItem('regulasus_token', data.token);
    setUsuario(data.usuario);
    return data.usuario;
  }

  function logout() {
    localStorage.removeItem('regulasus_token');
    setUsuario(null);
  }

  return (
    <AuthContext.Provider value={{ usuario, carregandoSessao, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}