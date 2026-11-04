const express = require('express');
const router = express.Router();
const {
    crearComunidad,
    unirseComunidad,
    obtenerUsuariosComunidad,
    obtenerDetalleComunidad,
    cambiarNombreComunidad,
    regenerarCodigoInvitacion,
    obtenerEstadoComunidad,
    cambiarEstadoComunidad,
    abandonarComunidad,
    transferirAdministracion,
    sacarMiembro
} = require('../controllers/comunidadController');
const { listarLotes, crearLote, eliminarLote, misLotes } = require('../controllers/loteController');
const { verificarToken } = require('../middlewares/verificarToken');
const { verificarComunidad, soloAdmin } = require('../middlewares/verificarComunidad');

router.post('/crear', crearComunidad);
router.post('/unirse', unirseComunidad);
router.get('/usuarios', verificarToken, obtenerUsuariosComunidad);

// Administrar comunidad: solo el administrador actual de la comunidad
router.get('/detalle', verificarToken, verificarComunidad, soloAdmin, obtenerDetalleComunidad);
router.put('/nombre', verificarToken, verificarComunidad, soloAdmin, cambiarNombreComunidad);
router.post('/codigo', verificarToken, verificarComunidad, soloAdmin, regenerarCodigoInvitacion);

// Estado de la campaña: cualquier miembro lo consulta; solo el admin cierra o reabre
router.get('/estado', verificarToken, verificarComunidad, obtenerEstadoComunidad);
router.put('/estado', verificarToken, verificarComunidad, soloAdmin, cambiarEstadoComunidad);

// Lotes por colaborador: el admin los asigna; cada miembro consulta los suyos
router.get('/lotes', verificarToken, verificarComunidad, soloAdmin, listarLotes);
router.post('/lotes', verificarToken, verificarComunidad, soloAdmin, crearLote);
router.delete('/lotes/:id', verificarToken, verificarComunidad, soloAdmin, eliminarLote);
router.get('/mis-lotes', verificarToken, verificarComunidad, misLotes);

// Salir de la comunidad (cualquier miembro) y pasar la administración (solo admin)
router.post('/abandonar', verificarToken, verificarComunidad, abandonarComunidad);
router.put('/admin', verificarToken, verificarComunidad, soloAdmin, transferirAdministracion);

// El admin saca a un colaborador de la comunidad
router.delete('/usuarios/:id', verificarToken, verificarComunidad, soloAdmin, sacarMiembro);

module.exports = router;
