const jwt = require('jsonwebtoken');
const db = require('../config/db');

async function autenticar(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ erro: 'Token de autenticação não informado.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const { rows } = await db.query(
      'SELECT id, nome, email, cargo, perfil, ativo FROM usuarios WHERE id = $1',
      [payload.id]
    );

    if (rows.length === 0 || !rows[0].ativo) {
      return res.status(401).json({ erro: 'Usuário inativo ou não autorizado.' });
    }

    req.usuario = rows[0];
    return next();
  } catch (err) {
    return res.status(401).json({ erro: 'Sessão expirada ou token inválido.' });
  }
}

function apenasAdmin(req, res, next) {
  if (req.usuario?.perfil !== 'ADMIN') {
    return res.status(403).json({ erro: 'Acesso restrito à coordenação (ADMIN).' });
  }
  return next();
}

module.exports = { autenticar, apenasAdmin };