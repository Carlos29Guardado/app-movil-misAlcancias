const ExcelJS = require('exceljs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

// El Excel se descarga abriendo un enlace en el navegador del teléfono, que no puede mandar
// el token de sesión. Por eso la app pide primero un enlace con un token que solo sirve para
// descargar (uso: 'exportar') y vence en pocos minutos.
const DURACION_ENLACE = '5m';

// Paso 1 (solo admin, con la sesión normal): genera el enlace de descarga
const crearEnlaceExportar = (req, res) => {
    const token = jwt.sign(
        { id: req.usuario.id, uso: 'exportar' },
        process.env.JWT_SECRET,
        { expiresIn: DURACION_ENLACE }
    );
    res.status(200).json({ ruta: `/alcancias/exportar/descarga?t=${encodeURIComponent(token)}` });
};

const estadoDe = (a) => (a.faltante ? 'Faltante' : a.devuelta ? 'Devuelta' : 'Colocada');

const FORMATO_DINERO = '"$"#,##0.00';

// Encabezado en negritas con fondo, igual en las dos hojas
const darFormatoEncabezado = (hoja) => {
    const fila = hoja.getRow(1);
    fila.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    fila.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF253237' } };
    hoja.views = [{ state: 'frozen', ySplit: 1 }];
};

// Paso 2 (enlace abierto en el navegador): arma y descarga el Excel de la comunidad
const descargarExcel = async (req, res) => {
    let datosToken;
    try {
        datosToken = jwt.verify(String(req.query.t || ''), process.env.JWT_SECRET);
    } catch (error) {
        return res.status(403).send('El enlace de descarga venció. Vuelve a tocar "Exportar a Excel" en la app.');
    }
    if (datosToken.uso !== 'exportar') {
        return res.status(403).send('Enlace de descarga inválido.');
    }

    try {
        // La comunidad y el rol se consultan de nuevo: pudo dejar de ser admin desde que pidió el enlace
        const { rows: [usuario] } = await pool.query(
            `SELECT u.rol, u.comunidad_id, c.nombre AS comunidad_nombre, c.rango_inicio, c.rango_fin
             FROM usuarios u
             LEFT JOIN comunidades c ON c.id = u.comunidad_id
             WHERE u.id = $1`,
            [datosToken.id]
        );
        if (!usuario || !usuario.comunidad_id || usuario.rol !== 'admin') {
            return res.status(403).send('Solo el administrador de la comunidad puede exportar las alcancías.');
        }

        const { rows: alcancias } = await pool.query(
            `SELECT a.codigo_alcancia, a.nombre_persona, a.colocada, a.devuelta, a.faltante,
                    a.monto_entregado, a.anio, u.nombre AS colaborador
             FROM alcancias a
             LEFT JOIN usuarios u ON u.id = a.usuario_id
             WHERE a.comunidad_id = $1
             ORDER BY a.codigo_alcancia ASC`,
            [usuario.comunidad_id]
        );

        const libro = new ExcelJS.Workbook();
        libro.creator = 'Recauda';
        libro.created = new Date();

        // Hoja 1: todas las alcancías, una por fila
        const hojaAlcancias = libro.addWorksheet('Alcancías');
        hojaAlcancias.columns = [
            { header: 'Número', key: 'codigo', width: 10 },
            { header: 'Persona', key: 'persona', width: 32 },
            { header: 'Estado', key: 'estado', width: 12 },
            { header: 'Monto entregado', key: 'monto', width: 18, style: { numFmt: FORMATO_DINERO } },
            { header: 'Registró', key: 'colaborador', width: 24 },
            { header: 'Año', key: 'anio', width: 8 },
        ];
        alcancias.forEach((a) => hojaAlcancias.addRow({
            codigo: a.codigo_alcancia,
            persona: a.nombre_persona,
            estado: estadoDe(a),
            monto: Number(a.monto_entregado) || 0,
            colaborador: a.colaborador || 'Sin nombre',
            anio: a.anio,
        }));
        darFormatoEncabezado(hojaAlcancias);
        // Fila de total con fórmula, así sigue cuadrando si editan montos en el Excel
        if (alcancias.length > 0) {
            const filaTotal = hojaAlcancias.addRow({
                persona: 'TOTAL',
                monto: { formula: `SUM(D2:D${alcancias.length + 1})` },
            });
            filaTotal.font = { bold: true };
        }

        // Hoja 2: resumen general y por colaborador
        const total = alcancias.reduce((suma, a) => suma + (Number(a.monto_entregado) || 0), 0);
        const contar = (estado) => alcancias.filter((a) => estadoDe(a) === estado).length;

        const porColaborador = new Map();
        alcancias.forEach((a) => {
            const nombre = a.colaborador || 'Sin nombre';
            const fila = porColaborador.get(nombre) || { registradas: 0, devueltas: 0, monto: 0 };
            fila.registradas += 1;
            if (estadoDe(a) === 'Devuelta') fila.devueltas += 1;
            fila.monto += Number(a.monto_entregado) || 0;
            porColaborador.set(nombre, fila);
        });

        const hojaResumen = libro.addWorksheet('Resumen');
        hojaResumen.columns = [
            { header: 'Concepto', key: 'concepto', width: 28 },
            { header: 'Valor', key: 'valor', width: 18 },
        ];
        const filasResumen = [
            ['Comunidad', usuario.comunidad_nombre || ''],
            ['Rango de alcancías', usuario.rango_inicio != null ? `${usuario.rango_inicio} a ${usuario.rango_fin}` : 'Sin rango'],
            ['Alcancías registradas', alcancias.length],
            ['Colocadas', contar('Colocada')],
            ['Devueltas', contar('Devuelta')],
            ['Faltantes', contar('Faltante')],
            ['Total recaudado', total],
            ['Fecha de exportación', new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })],
        ];
        filasResumen.forEach(([concepto, valor]) => hojaResumen.addRow({ concepto, valor }));
        hojaResumen.getCell('B8').numFmt = FORMATO_DINERO;
        darFormatoEncabezado(hojaResumen);

        // Tabla por colaborador, debajo del resumen general
        hojaResumen.addRow([]);
        const encabezadoColab = hojaResumen.addRow(['Colaborador', 'Registradas', 'Devueltas', 'Monto']);
        encabezadoColab.font = { bold: true };
        hojaResumen.getColumn(3).width = 12;
        hojaResumen.getColumn(4).width = 16;
        [...porColaborador.entries()]
            .sort((a, b) => b[1].monto - a[1].monto)
            .forEach(([nombre, f]) => {
                const fila = hojaResumen.addRow([nombre, f.registradas, f.devueltas, f.monto]);
                fila.getCell(4).numFmt = FORMATO_DINERO;
            });

        const fecha = new Date().toISOString().slice(0, 10);
        const nombreArchivo = `alcancias-${fecha}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}"`);
        await libro.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Error al exportar alcancías:', error);
        if (!res.headersSent) res.status(500).send('No se pudo generar el Excel. Intenta de nuevo.');
    }
};

module.exports = { crearEnlaceExportar, descargarExcel };
