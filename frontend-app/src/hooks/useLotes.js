import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { fetchApi } from '../services/api';

const MENSAJE_SIN_CONEXION = 'Necesitas conexión a internet para administrar los lotes.';

// Primer tramo de números del rango de la comunidad que no está en ningún lote.
// Devuelve { inicio, fin } (fin es null si la comunidad no tiene rango definido),
// o null cuando ya se repartieron todos los números del rango.
const buscarNumerosLibres = (datos) => {
    const lotes = datos.miembros
        .flatMap((m) => m.lotes)
        .map((l) => ({ inicio: Number(l.rango_inicio), fin: Number(l.rango_fin) }))
        .sort((a, b) => a.inicio - b.inicio);
    const rangoInicio = datos.rango_inicio != null ? Number(datos.rango_inicio) : null;
    const rangoFin = datos.rango_fin != null ? Number(datos.rango_fin) : null;

    // Sin rango de la comunidad: se sugiere el número siguiente al último lote
    if (rangoInicio == null || rangoFin == null) {
        if (lotes.length === 0) return { inicio: rangoInicio, fin: null };
        return { inicio: Math.max(...lotes.map((l) => l.fin)) + 1, fin: null };
    }

    // Se recorren los lotes en orden buscando el primer hueco (puede quedar uno al quitar un lote)
    let siguiente = rangoInicio;
    for (const lote of lotes) {
        if (lote.inicio > siguiente) {
            return { inicio: siguiente, fin: Math.min(lote.inicio - 1, rangoFin) };
        }
        siguiente = Math.max(siguiente, lote.fin + 1);
    }
    return siguiente <= rangoFin ? { inicio: siguiente, fin: rangoFin } : null;
};

export const useLotes = () => {
    const [datos, setDatos] = useState(/** @type {any} */ (null));
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState(null);

    // Formulario para asignar un lote nuevo
    const [usuarioSeleccionado, setUsuarioSeleccionado] = useState(/** @type {number | null} */ (null));
    const [desde, setDesde] = useState('');
    const [hasta, setHasta] = useState('');
    const [guardando, setGuardando] = useState(false);
    // Números todavía sin lote, o null si ya se repartieron todos
    const [libres, setLibres] = useState(/** @type {{ inicio: number | null, fin: number | null } | null} */ (null));

    const cargarLotes = async () => {
        try {
            setError(null);
            const respuesta = await fetchApi('/comunidad/lotes', {}, 8000);
            const json = await respuesta.json();

            if (!respuesta.ok) {
                setError(json.mensaje || json.error || 'No se pudieron cargar los lotes.');
                return;
            }

            setDatos(json);
            const numerosLibres = buscarNumerosLibres(json);
            setLibres(numerosLibres);
            setDesde(numerosLibres?.inicio != null ? String(numerosLibres.inicio) : '');
            setHasta('');
        } catch (err) {
            console.log('No se pudieron cargar los lotes:', err?.message || err);
            setError(MENSAJE_SIN_CONEXION);
        } finally {
            setCargando(false);
        }
    };

    // Se ejecuta automáticamente al abrir la pantalla
    useFocusEffect(
        useCallback(() => {
            cargarLotes();
        }, [])
    );

    const asignarLote = async () => {
        const inicio = Number(desde);
        const fin = Number(hasta);

        if (usuarioSeleccionado == null) {
            Alert.alert('Elige un colaborador', 'Toca el nombre de la persona a quien le vas a entregar el lote.');
            return;
        }
        if (!desde || !hasta || !Number.isInteger(inicio) || !Number.isInteger(fin)) {
            Alert.alert('Faltan números', 'Escribe el primer y el último número del lote.');
            return;
        }
        if (inicio > fin) {
            Alert.alert('Rango inválido', 'El primer número no puede ser mayor que el último.');
            return;
        }

        setGuardando(true);
        try {
            const respuesta = await fetchApi('/comunidad/lotes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ usuario_id: usuarioSeleccionado, rango_inicio: inicio, rango_fin: fin })
            });
            const json = await respuesta.json();

            if (!respuesta.ok) {
                Alert.alert('No se pudo asignar', json.mensaje || 'Revisa los números del lote.');
                return;
            }

            Alert.alert('Lote asignado', `${json.mensaje}: ${inicio} a ${fin} (${fin - inicio + 1} alcancías).`);
            setUsuarioSeleccionado(null);
            await cargarLotes();
        } catch (err) {
            Alert.alert('Sin conexión', MENSAJE_SIN_CONEXION);
        } finally {
            setGuardando(false);
        }
    };

    const eliminarLote = (lote, nombre) => {
        Alert.alert(
            'Quitar lote',
            `¿Quitar el lote ${lote.rango_inicio} a ${lote.rango_fin} de ${nombre}? Solo se puede si todavía no tiene alcancías registradas.`,
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Quitar',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const respuesta = await fetchApi(`/comunidad/lotes/${lote.id}`, { method: 'DELETE' });
                            const json = await respuesta.json();
                            if (!respuesta.ok) {
                                Alert.alert('No se pudo quitar', json.mensaje || 'Intenta de nuevo.');
                                return;
                            }
                            await cargarLotes();
                        } catch (err) {
                            Alert.alert('Sin conexión', MENSAJE_SIN_CONEXION);
                        }
                    }
                }
            ]
        );
    };

    return {
        datos,
        cargando,
        error,
        usuarioSeleccionado, setUsuarioSeleccionado,
        desde, setDesde,
        hasta, setHasta,
        guardando,
        libres,
        asignarLote,
        eliminarLote,
        reintentar: cargarLotes
    };
};
