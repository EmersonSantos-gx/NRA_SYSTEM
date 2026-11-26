const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('../backend/src/routes/authRoutes');
const usuariosRoutes = require('../backend/src/routes/usuariosRoutes');
const procedimentosRoutes = require('../backend/src/routes/procedimentosRoutes');
const pacientesRoutes = require('../backend/src/routes/pacientesRoutes');
const tarefasRoutes = require('../backend/src/routes/tarefasRoutes');
const agendasRoutes = require('../backend/src/routes/agendasRoutes');
const demandasRoutes = require('../backend/src/routes/demandasRoutes');

const app = express();

// Configuração de CORS para aceitar requisições locais e online (ex: www.nragx.sbs)
const corsOptions = {
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json({ limit: '10mb' }));

// Rota de saúde para verificar se a API e o banco estão acessíveis
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    servico: 'NRA API (Vercel Serverless)',
    banco: 'Neon PostgreSQL'
  });
});

// Registro das rotas principais da aplicação
app.use('/api/auth', authRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/procedimentos', procedimentosRoutes);
app.use('/api/acompanhamentos', pacientesRoutes);
app.use('/api/tarefas', tarefasRoutes);
app.use('/api/agendas', agendasRoutes);
app.use('/api/demandas', demandasRoutes);

// Middleware de tratamento de erros inesperados na função serverless
app.use((err, req, res, next) => {
  console.error('Erro na API Serverless NRA:', err);
  res.status(err.status || 500).json({
    erro: err.message || 'Erro interno no servidor da API.'
  });
});

module.exports = app;