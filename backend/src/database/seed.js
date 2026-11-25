const bcrypt = require('bcryptjs');
const db = require('../config/db');

async function seed() {
  try {
    console.log('Conectando ao PostgreSQL (Neon)...');
    const teste = await db.query('SELECT NOW() AS agora');
    console.log('Conexão OK! Hora do servidor Neon:', teste.rows[0].agora);

    const senhaHash = await bcrypt.hash('123456', 10);

    const usuarios = [
      {
        nome: 'Dra. Beatriz Alencar',
        email: 'admin@regulasus.gov.br',
        cargo: 'Coordenadora de Regulação',
        perfil: 'ADMIN'
      },
      {
        nome: 'Lucas Mendes',
        email: 'operador@regulasus.gov.br',
        cargo: 'Técnico em Regulação',
        perfil: 'OPERADOR'
      },
      {
        nome: 'Rafael Oliveira',
        email: 'rafael.o@regulasus.gov.br',
        cargo: 'Técnico em Regulação',
        perfil: 'OPERADOR'
      }
    ];

    for (const u of usuarios) {
      await db.query(
        `INSERT INTO usuarios (nome, email, senha_hash, cargo, perfil, ativo)
         VALUES ($1, $2, $3, $4, $5, TRUE)
         ON CONFLICT (email) DO NOTHING`,
        [u.nome, u.email, senhaHash, u.cargo, u.perfil]
      );
    }

    console.log('Usuários iniciais prontos! (Senha padrão de teste: 123456)');
    process.exit(0);
  } catch (err) {
    console.error('Erro ao conectar ou popular o Neon:', err.message);
    process.exit(1);
  }
}

seed();