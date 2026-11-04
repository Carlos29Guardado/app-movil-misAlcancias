const pool = require('../config/db');

// Carga la comunidad y el rol ACTUALES del usuario desde la base de datos.
// El token del login manual solo trae id y email, y la comunidad puede cambiar
// después del login (crear o unirse), así que no se toman del token.
const verificarComunidad = async (req, res, next) => {
    try {
        const { rows } = await pool.query(
            `SELECT u.comunidad_id, u.rol, c.activa
             FROM usuarios u
             LEFT JOIN comunidades c ON c.id = u.comunidad_id
             WHERE u.id = $1`,
            [req.usuario.id]
        );

        if (rows.length === 0 || !rows[0].comunidad_id) {
            // `sin_comunidad` le indica a la app que el admin lo sacó (o ya salió) de la comunidad
            return res.status(403).json({ error: 'No perteneces a ninguna comunidad.', sin_comunidad: true });
        }

        req.comunidadId = Number(rows[0].comunidad_id);
        req.rolActual = rows[0].rol;
        // Si la columna aún no existe (migración pendiente) se considera activa
        req.comunidadActiva = rows[0].activa !== false;
        next();
    } catch (error) {
        console.error('Error verificando la comunidad del usuario:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

// Usar después de verificarComunidad: solo deja pasar al administrador actual de la comunidad
const soloAdmin = (req, res, next) => {
    if (req.rolActual !== 'admin') {
        return res.status(403).json({ mensaje: 'Solo el administrador puede hacer esto.' });
    }
    next();
};

// Usar después de verificarComunidad: bloquea registrar o modificar en una comunidad cerrada.
// `comunidad_cerrada` le indica a la app que no es un error de sesión ni de permisos.
const soloComunidadActiva = (req, res, next) => {
    if (!req.comunidadActiva) {
        return res.status(403).json({
            error: 'La comunidad está cerrada: la campaña terminó y sus datos son solo de consulta.',
            mensaje: 'La comunidad está cerrada: la campaña terminó y sus datos son solo de consulta.',
            comunidad_cerrada: true
        });
    }
    next();
};

module.exports = { verificarComunidad, soloAdmin, soloComunidadActiva };
