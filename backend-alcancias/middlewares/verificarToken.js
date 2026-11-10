const jwt = require('jsonwebtoken');

const verificarToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Acceso denegado. No hay token de autenticación.' });
  }

  try {
    const usuarioDecodificado = jwt.verify(token, process.env.JWT_SECRET);
    // Un token de uso específico (por ejemplo, el del enlace para descargar el Excel) no sirve como sesión
    if (usuarioDecodificado.uso) {
      return res.status(403).json({ error: 'Token inválido o expirado.' });
    }
    req.usuario = usuarioDecodificado; 
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Token inválido o expirado.' });
  }
};

module.exports = { verificarToken };