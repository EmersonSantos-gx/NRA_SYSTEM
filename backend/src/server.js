const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const usuariosRoutes = require('./routes/usuariosRoutes');
const procedimentosRoutes = require('./routes/procedimentosRoutes');
const pacientesRoutes = require('./routes/pacientesRoutes');
const tarefasRoutes = require('./routes/tarefasRoutes');
const agendasRoutes = require('./routes/agendasRoutes');
const demandasRoutes = require('./routes/demandasRoutes');

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', servico: 'RegulaSUS API', banco: 'Neon PostgreSQL' });
});

app.use('/api/auth', authRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/procedimentos', procedimentosRoutes);
app.use('/api/acompanhamentos', pacientesRoutes);
app.use('/api/tarefas', tarefasRoutes);
app.use('/api/agendas', agendasRoutes);
app.use('/api/demandas', demandasRoutes);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`API RegulaSUS rodando em http://localhost:${PORT}`);
});