const pool = require('../config/db');

const crearComunidad = async (req, res) => {
    const {nombre, emailUsuario, rango_inicio, rango_fin} = req.body;

    //Genera un código aleatorio de 6 caracteres
    const codigoInvitacion = Math.random().toString(36).substring(2,8).toUpperCase();

    try {
        await pool.query('BEGIN');

        //Crear comunidad
        const resultComunidad = await pool.query(
            'INSERT INTO comunidades (nombre, codigo_invitacion, rango_inicio, rango_fin) VALUES ($1, $2, $3, $4) RETURNING id, codigo_invitacion',
            [nombre, codigoInvitacion, rango_inicio, rango_fin]
        );
        const nuevaComunidadId = resultComunidad.rows[0].id;

        //Hacer administrador al creador
        await pool.query(
            "UPDATE usuarios SET comunidad_id = $1, rol = 'admin' WHERE email = $2",
            [nuevaComunidadId, emailUsuario]
        );
        await pool.query('COMMIT'); // Confirma cambios

        res.status(201).json({ 
            mensaje: 'Comunidad creada exitosamente',
            codigo_invitacion: codigoInvitacion,
            comunidad_id: nuevaComunidadId
        });
    } catch (error) {
        await pool.query('ROLLBACK'); // Deshace si hay error
        console.error('Error al crear comunidad:', error);
        res.status(500).json({ mensaje: 'Error interno del servidor.' });
    }
}
const unirseComunidad = async (req, res) => {
    const { codigo_invitacion, emailUsuario } = req.body; 

    try {
        // Buscar la comunidad por código
        const resultComunidad = await pool.query(
            'SELECT id, nombre, activa FROM comunidades WHERE codigo_invitacion = $1',
            [codigo_invitacion]
        );

        if (resultComunidad.rows.length === 0) {
            return res.status(404).json({ mensaje: 'Código de verificación inválido o no existe.' });
        }

        const comunidadEncontrada = resultComunidad.rows[0];

        // A una comunidad cerrada ya no se puede unir nadie
        if (comunidadEncontrada.activa === false) {
            return res.status(403).json({ mensaje: 'Esta comunidad está cerrada: su campaña ya terminó.' });
        }

        // Asignar el usuario a la comunidad como colaborador
        await pool.query(
            "UPDATE usuarios SET comunidad_id = $1, rol = 'colaborador' WHERE email = $2",
            [comunidadEncontrada.id, emailUsuario]
        );

        res.status(200).json({ 
            mensaje: 'Te has unido exitosamente',
            comunidad_id: comunidadEncontrada.id,
            comunidad_nombre: comunidadEncontrada.nombre
        });

    } catch (error) {
        console.error('Error al unirse a la comunidad:', error);
        res.status(500).json({ mensaje: 'Error interno del servidor.' });
    }
};

const obtenerUsuariosComunidad = async (req, res) => {
    try {
        // El token del login manual solo trae id y email, y el rol/comunidad pueden
        // haber cambiado después del login, así que se consultan en la base de datos
        const resultSolicitante = await pool.query(
            'SELECT comunidad_id, rol FROM usuarios WHERE id = $1',
            [req.usuario.id]
        );

        const solicitante = resultSolicitante.rows[0];

        if (!solicitante || !solicitante.comunidad_id) {
            return res.status(404).json({ mensaje: 'No perteneces a ninguna comunidad.' });
        }

        if (solicitante.rol !== 'admin') {
            return res.status(403).json({ mensaje: 'Solo el administrador puede ver los usuarios de la comunidad.' });
        }

        // Primero el administrador y después los colaboradores, ordenados por nombre
        const resultUsuarios = await pool.query(
            `SELECT id, nombre, email, rol
             FROM usuarios
             WHERE comunidad_id = $1
             ORDER BY CASE WHEN rol = 'admin' THEN 0 ELSE 1 END, nombre ASC`,
            [solicitante.comunidad_id]
        );

        res.status(200).json(resultUsuarios.rows);
    } catch (error) {
        console.error('Error al obtener usuarios de la comunidad:', error);
        res.status(500).json({ mensaje: 'Error interno del servidor.' });
    }
};

// Genera un código de invitación de 6 caracteres que no esté usado por otra comunidad
const generarCodigoUnico = async () => {
    for (let intento = 0; intento < 10; intento++) {
        const codigo = Math.random().toString(36).substring(2, 8).toUpperCase();
        const { rows } = await pool.query('SELECT 1 FROM comunidades WHERE codigo_invitacion = $1', [codigo]);
        if (rows.length === 0 && codigo.length === 6) return codigo;
    }
    throw new Error('No se pudo generar un código de invitación único');
};

// Datos de la comunidad para la pantalla "Administrar comunidad" (solo admin)
const obtenerDetalleComunidad = async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT c.id, c.nombre, c.codigo_invitacion, c.rango_inicio, c.rango_fin, c.activa, c.fecha_cierre,
                    (SELECT COUNT(*) FROM usuarios u WHERE u.comunidad_id = c.id) AS total_miembros,
                    (SELECT COUNT(*) FROM alcancias a WHERE a.comunidad_id = c.id) AS total_alcancias
             FROM comunidades c
             WHERE c.id = $1`,
            [req.comunidadId]
        );

        if (rows.length === 0) {
            return res.status(404).json({ mensaje: 'Comunidad no encontrada.' });
        }

        const c = rows[0];
        res.status(200).json({
            id: c.id,
            nombre: c.nombre,
            codigo_invitacion: c.codigo_invitacion,
            rango_inicio: c.rango_inicio,
            rango_fin: c.rango_fin,
            total_miembros: Number(c.total_miembros),
            total_alcancias: Number(c.total_alcancias),
            activa: c.activa !== false,
            fecha_cierre: c.fecha_cierre
        });
    } catch (error) {
        console.error('Error al obtener detalle de la comunidad:', error);
        res.status(500).json({ mensaje: 'Error interno del servidor.' });
    }
};

// Cambia el nombre de la comunidad (solo admin)
const cambiarNombreComunidad = async (req, res) => {
    const nombre = String(req.body.nombre || '').trim();

    if (nombre.length < 3 || nombre.length > 60) {
        return res.status(400).json({ mensaje: 'El nombre debe tener entre 3 y 60 caracteres.' });
    }

    try {
        const { rows } = await pool.query(
            'UPDATE comunidades SET nombre = $1 WHERE id = $2 RETURNING nombre',
            [nombre, req.comunidadId]
        );
        res.status(200).json({ mensaje: 'Nombre actualizado', nombre: rows[0].nombre });
    } catch (error) {
        console.error('Error al cambiar el nombre de la comunidad:', error);
        res.status(500).json({ mensaje: 'Error interno del servidor.' });
    }
};

// Genera un código de invitación nuevo; el anterior deja de funcionar (solo admin)
const regenerarCodigoInvitacion = async (req, res) => {
    try {
        const codigo = await generarCodigoUnico();
        await pool.query(
            'UPDATE comunidades SET codigo_invitacion = $1 WHERE id = $2',
            [codigo, req.comunidadId]
        );
        res.status(200).json({ mensaje: 'Código actualizado', codigo_invitacion: codigo });
    } catch (error) {
        console.error('Error al regenerar el código de invitación:', error);
        res.status(500).json({ mensaje: 'Error interno del servidor.' });
    }
};

// Estado de la comunidad para cualquier miembro: la app lo usa para saber si está cerrada
// y cuál es su rol actual (puede cambiar desde otro teléfono, por ejemplo al hacerlo administrador)
const obtenerEstadoComunidad = (req, res) => {
    res.status(200).json({ activa: req.comunidadActiva, rol: req.rolActual });
};

// Cierra (campaña finalizada) o reabre la comunidad (solo admin)
const cambiarEstadoComunidad = async (req, res) => {
    if (typeof req.body.activa !== 'boolean') {
        return res.status(400).json({ mensaje: 'Indica si la comunidad queda activa (true) o cerrada (false).' });
    }
    const activa = req.body.activa;

    try {
        const { rows } = await pool.query(
            `UPDATE comunidades
             SET activa = $1, fecha_cierre = CASE WHEN $1 THEN NULL ELSE NOW() END
             WHERE id = $2
             RETURNING activa, fecha_cierre`,
            [activa, req.comunidadId]
        );
        res.status(200).json({
            mensaje: activa ? 'Comunidad reabierta' : 'Comunidad cerrada',
            activa: rows[0].activa,
            fecha_cierre: rows[0].fecha_cierre
        });
    } catch (error) {
        console.error('Error al cambiar el estado de la comunidad:', error);
        res.status(500).json({ mensaje: 'Error interno del servidor.' });
    }
};

// El usuario sale de su comunidad (colaborador o admin).
// - Sus alcancías se quedan en la comunidad (son de la comunidad, no de la persona).
// - Sus lotes se quitan: los números que no usó quedan libres para asignarlos a otra persona.
// - Admin con más miembros: debe indicar nuevo_admin_id (quien queda como administrador).
// - Admin que es el único miembro: la comunidad se cierra y queda archivada (no se borra nada).
const abandonarComunidad = async (req, res) => {
    let client;
    try {
        client = await pool.connect();
        await client.query('BEGIN');

        const { rows: otros } = await client.query(
            'SELECT id, nombre FROM usuarios WHERE comunidad_id = $1 AND id <> $2',
            [req.comunidadId, req.usuario.id]
        );

        let mensaje = 'Saliste de la comunidad.';

        if (req.rolActual === 'admin') {
            if (otros.length > 0) {
                const nuevoAdmin = otros.find((o) => Number(o.id) === Number(req.body.nuevo_admin_id));
                if (!nuevoAdmin) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({
                        mensaje: 'Antes de salir elige quién será el nuevo administrador de la comunidad.',
                        requiere_nuevo_admin: true
                    });
                }
                await client.query("UPDATE usuarios SET rol = 'admin' WHERE id = $1", [nuevoAdmin.id]);
                mensaje = `Saliste de la comunidad. ${nuevoAdmin.nombre} es ahora el administrador.`;
            } else {
                // Era el único miembro: la comunidad queda cerrada y archivada con todos sus datos
                await client.query(
                    'UPDATE comunidades SET activa = false, fecha_cierre = COALESCE(fecha_cierre, NOW()) WHERE id = $1',
                    [req.comunidadId]
                );
                mensaje = 'Saliste de la comunidad. Como eras el único miembro, quedó cerrada y archivada.';
            }
        }

        await client.query('DELETE FROM lotes WHERE comunidad_id = $1 AND usuario_id = $2', [req.comunidadId, req.usuario.id]);
        await client.query(
            "UPDATE usuarios SET comunidad_id = NULL, rol = 'colaborador' WHERE id = $1",
            [req.usuario.id]
        );

        await client.query('COMMIT');
        res.status(200).json({ mensaje });
    } catch (error) {
        if (client) await client.query('ROLLBACK').catch(() => {});
        console.error('Error al abandonar la comunidad:', error);
        res.status(500).json({ mensaje: 'Error interno del servidor.' });
    } finally {
        if (client) client.release();
    }
};

// El admin le pasa la administración a otro miembro y él queda como colaborador (solo admin)
const transferirAdministracion = async (req, res) => {
    const nuevoAdminId = Number(req.body.usuario_id);
    if (!Number.isInteger(nuevoAdminId) || nuevoAdminId === Number(req.usuario.id)) {
        return res.status(400).json({ mensaje: 'Elige a otro miembro de la comunidad.' });
    }

    let client;
    try {
        client = await pool.connect();
        await client.query('BEGIN');

        const { rows: [nuevoAdmin] } = await client.query(
            'SELECT id, nombre FROM usuarios WHERE id = $1 AND comunidad_id = $2',
            [nuevoAdminId, req.comunidadId]
        );
        if (!nuevoAdmin) {
            await client.query('ROLLBACK');
            return res.status(404).json({ mensaje: 'Esa persona no pertenece a tu comunidad.' });
        }

        await client.query("UPDATE usuarios SET rol = 'admin' WHERE id = $1", [nuevoAdmin.id]);
        await client.query("UPDATE usuarios SET rol = 'colaborador' WHERE id = $1", [req.usuario.id]);

        await client.query('COMMIT');
        res.status(200).json({ mensaje: `${nuevoAdmin.nombre} es ahora el administrador. Tú quedaste como colaborador.` });
    } catch (error) {
        if (client) await client.query('ROLLBACK').catch(() => {});
        console.error('Error al transferir la administración:', error);
        res.status(500).json({ mensaje: 'Error interno del servidor.' });
    } finally {
        if (client) client.release();
    }
};

// El admin saca a un colaborador de la comunidad (solo admin).
// Igual que al abandonar: sus alcancías se quedan en la comunidad y sus lotes se quitan,
// así los números que no usó quedan libres para asignarlos a otra persona.
const sacarMiembro = async (req, res) => {
    const miembroId = Number(req.params.id);
    if (!Number.isInteger(miembroId) || miembroId === Number(req.usuario.id)) {
        return res.status(400).json({ mensaje: 'Para salir tú de la comunidad usa "Abandonar comunidad".' });
    }

    let client;
    try {
        client = await pool.connect();
        await client.query('BEGIN');

        const { rows: [miembro] } = await client.query(
            'SELECT id, nombre, email, rol FROM usuarios WHERE id = $1 AND comunidad_id = $2 FOR UPDATE',
            [miembroId, req.comunidadId]
        );
        if (!miembro) {
            await client.query('ROLLBACK');
            return res.status(404).json({ mensaje: 'Esa persona ya no pertenece a tu comunidad.' });
        }
        if (miembro.rol === 'admin') {
            await client.query('ROLLBACK');
            return res.status(400).json({ mensaje: 'No se puede sacar al administrador de la comunidad.' });
        }

        await client.query('DELETE FROM lotes WHERE comunidad_id = $1 AND usuario_id = $2', [req.comunidadId, miembro.id]);
        await client.query(
            "UPDATE usuarios SET comunidad_id = NULL, rol = 'colaborador' WHERE id = $1",
            [miembro.id]
        );

        await client.query('COMMIT');
        res.status(200).json({ mensaje: `${miembro.nombre || miembro.email} ya no pertenece a la comunidad.` });
    } catch (error) {
        if (client) await client.query('ROLLBACK').catch(() => {});
        console.error('Error al sacar al miembro de la comunidad:', error);
        res.status(500).json({ mensaje: 'Error interno del servidor.' });
    } finally {
        if (client) client.release();
    }
};

module.exports = {
    sacarMiembro,
    abandonarComunidad,
    transferirAdministracion,
    obtenerEstadoComunidad,
    cambiarEstadoComunidad,
    crearComunidad,
    unirseComunidad,
    obtenerUsuariosComunidad,
    obtenerDetalleComunidad,
    cambiarNombreComunidad,
    regenerarCodigoInvitacion
};