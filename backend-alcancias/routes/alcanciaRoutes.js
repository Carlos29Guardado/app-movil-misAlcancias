const express = require('express');
const router = express.Router();
const { verificarAdmin } = require('../middlewares/verificarRol')
const alcanciaController = require('../controllers/alcanciaController');
const { sincronizarAlcanciasOffline } = require('../controllers/alcanciaController');
const { verificarToken } = require('../middlewares/verificarToken');
const { verificarComunidad, soloComunidadActiva, soloAdmin } = require('../middlewares/verificarComunidad');
const { crearEnlaceExportar, descargarExcel } = require('../controllers/exportarController');

// Descarga del Excel: se abre en el navegador, que no manda la sesión; usa el token del enlace
router.get('/exportar/descarga', descargarExcel);

// Todas las rutas de alcancías requieren sesión y pertenecer a una comunidad
router.use(verificarToken, verificarComunidad);

// Consultar se permite siempre; registrar o modificar solo si la comunidad sigue activa
router.post('/', soloComunidadActiva, alcanciaController.crearAlcancia);
router.get('/comunidad/:comunidad_id', alcanciaController.obtenerAlcancias);
router.put('/:codigo', soloComunidadActiva, alcanciaController.actualizarAlcancia)
router.get('/siguiente/:comunidad_id', alcanciaController.obtenerSiguienteAlcancia);
router.post('/sincronizar', soloComunidadActiva, sincronizarAlcanciasOffline);

// Exportar a Excel (solo admin): devuelve un enlace de descarga que vence en minutos
router.post('/exportar/enlace', soloAdmin, crearEnlaceExportar);


module.exports = router;
