const { OAuth2Client } = require('google-auth-library');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const client = new OAuth2Client();

// Duración de la sesión. Los colaboradores trabajan días sin internet; con 30 días no se les
// vence la sesión a media campaña (al cerrar sesión se borra igual).
const DURACION_SESION = '30d';

const registro = async (req, res) => {
    const { nombre, email, password } = req.body;

    if (!String(nombre || '').trim() || !String(email || '').trim() || !password) {
        return res.status(400).json({ mensaje: 'Completa nombre, correo y contraseña.' });
    }

    try {
        const usuarioExistente = await pool.query
            ('SELECT * FROM usuarios WHERE email = $1', [email]);
        if (usuarioExistente.rows.length > 0) {
            return res.status(400).json({ mensaje: 'Este correo ya esta registrado' });
        }

        //Encriptar la contraseña
        const salt = await bcrypt.genSalt(10);
        const passwordEncriptada = await bcrypt.hash(password, salt);
        //Guardar en nuevo usuario en la base de datos en Neon
        const nuevoUsuario = await pool.query(
            'INSERT INTO usuarios (nombre, email, password, rol, comunidad_id) VALUES ($1, $2, $3, $4, $5) RETURNING id, nombre, email',
            [nombre, email, passwordEncriptada, 'colaborador', null]
        );
        res.status(201).json({
            mensaje: 'Usuario registrado exitosamente',
            usuario: nuevoUsuario.rows[0]
        });
    } catch (error) {
        console.error('Error en el registro:', error);
        res.status(500).json({ mensaje: 'Error interno del servidor al registrar.' });
    }
}

const loginManual = async (req, res) => {
    const { email, password } = req.body;

    try {
        const { rows } = await pool.query(`
            SELECT u.*, 
             c.nombre AS comunidad_nombre, 
             c.codigo_invitacion AS comunidad_codigo,
             c.rango_inicio,
             c.rango_fin,
             c.activa AS comunidad_activa
      FROM usuarios u
      LEFT JOIN comunidades c ON u.comunidad_id = c.id
      WHERE u.email = $1
        `, [email]);

        if (rows.length === 0) {
            return res.status(401).json({ mensaje: 'El correo no esta registrado. ' });
        }

        const usuario = rows[0];

        // Las cuentas creadas con Google no tienen contraseña
        if (!usuario.password) {
            return res.status(401).json({ mensaje: 'Esta cuenta se creó con Google. Inicia sesión con el botón de Google.' });
        }

        const passwordValida = await bcrypt.compare(String(password || ''), usuario.password);

        if (!passwordValida) {
            return res.status(401).json({ mensaje: 'Contraseña incorrecta.' });
        }

        //Token de sesión
        const token = jwt.sign(
            { id: usuario.id, email: usuario.email },
            process.env.JWT_SECRET,
            { expiresIn: DURACION_SESION }
        )
        res.json({
            token,
            usuario: {
                id: usuario.id,
                nombre: usuario.nombre,
                email: usuario.email,
                rol: usuario.rol,
                comunidad_id: usuario.comunidad_id,
                comunidad_nombre: usuario.comunidad_nombre,
                comunidad_codigo: usuario.comunidad_codigo,
                rango_inicio: usuario.rango_inicio,
                rango_fin: usuario.rango_fin,
                comunidad_activa: usuario.comunidad_activa
            }
        });
    } catch (error) {
        console.error('Error en loginManual:', error);
        res.status(500).json({ mensaje: 'Error interno del servidor.' });
    }
}

const loginGoogle = async (req, res) => {
    const { idToken } = req.body;

    try {
        const ticket = await client.verifyIdToken({
            idToken,
            audience: [
                process.env.GOOGLE_CLIENTE_ID,
                process.env.GOOGLE_ANDROID_CLIENT_ID
            ]
        });

        const { email, name } = ticket.getPayload();
        const resultado = await pool.query(`
            SELECT u.*, 
             c.nombre AS comunidad_nombre, 
             c.codigo_invitacion AS comunidad_codigo,
             c.rango_inicio,
             c.rango_fin,
             c.activa AS comunidad_activa
      FROM usuarios u
      LEFT JOIN comunidades c ON u.comunidad_id = c.id
      WHERE u.email = $1
        `, [email]);

        let usuario = resultado.rows[0];

        if (!usuario) {
            const nuevoUser = await pool.query(
                'INSERT INTO usuarios (email, nombre, rol, comunidad_id) VALUES ($1, $2, $3, $4) RETURNING *',
                [email, name, 'colaborador', null]
            );
            usuario = nuevoUser.rows[0];
            usuario.comunidad_nombre = null;
            usuario.rango_inicio = null;
            usuario.rango_fin = null;
        }
        const token = jwt.sign(
            { id: usuario.id, rol: usuario.rol, comunidad_id: usuario.comunidad_id },
            process.env.JWT_SECRET,
            { expiresIn: DURACION_SESION }
        );

        res.json({
            mensaje: 'Autenticación exitosa',
            token: token,
            usuario: {
                id: usuario.id,
                nombre: usuario.nombre,
                email: usuario.email,
                rol: usuario.rol,
                comunidad_id: usuario.comunidad_id,
                comunidad_nombre: usuario.comunidad_nombre,
                comunidad_codigo: usuario.comunidad_codigo,
                rango_inicio: usuario.rango_inicio,
                rango_fin: usuario.rango_fin,
                comunidad_activa: usuario.comunidad_activa
            }
        });

    } catch (error) {
        res.status(401).json({ error: 'Token de Google inválido' });
    }
};

module.exports = {
    loginManual,
    loginGoogle,
    registro
};