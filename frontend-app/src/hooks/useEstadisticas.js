import { useState, useCallback, useMemo } from 'react';
import { Alert, Linking } from 'react-native';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { fetchApi } from '../services/api';
import { API_URL } from '../../config/config';
import { obtenerAlcanciasLocales, guardarAlcanciasServidor } from '../../database/sqlite';
import { sincronizarPendientes } from './useSincronizacion';

const TIEMPO_ESPERA_MS = 8000;

// Estado de la alcancía según los booleanos de la BD (0/1 en SQLite)
const obtenerEstado = (item) => {
    if (item.faltante) return 'Faltante';
    if (item.devuelta) return 'Devuelta';
    return 'Colocada';
};

// Las estadísticas se calculan con la copia del teléfono, así el panel funciona sin internet.
// Si hay conexión, primero se suben los pendientes y se trae lo más reciente del servidor.
export const useEstadisticas = () => {
    const [usuario, setUsuario] = useState(/** @type {any} */ (null));
    const [alcancias, setAlcancias] = useState(/** @type {any[]} */ ([]));
    // Nombres de los miembros (solo admin, con internet) para la tabla por colaborador
    const [nombres, setNombres] = useState(/** @type {Record<string, string>} */ ({}));
    const [sinConexion, setSinConexion] = useState(false);
    const [cargando, setCargando] = useState(true);
    const [refrescando, setRefrescando] = useState(false);
    const [exportando, setExportando] = useState(false);

    const esAdmin = usuario?.rol === 'admin';

    const cargar = async () => {
        let sesion = null;
        try {
            sesion = JSON.parse((await AsyncStorage.getItem('userData')) || '{}');
            setUsuario(sesion);

            const estadoRed = await NetInfo.fetch();
            if (estadoRed.isConnected === false || estadoRed.isInternetReachable === false) {
                setSinConexion(true);
                return;
            }

            await sincronizarPendientes();
            const respuesta = await fetchApi(`/alcancias/comunidad/${sesion.comunidad_id}`, {}, TIEMPO_ESPERA_MS);
            if (!respuesta.ok) throw new Error(`El servidor respondió con estado ${respuesta.status}`);
            guardarAlcanciasServidor(await respuesta.json(), sesion.comunidad_id);
            setSinConexion(false);

            if (sesion.rol === 'admin') {
                const respuestaUsuarios = await fetchApi('/comunidad/usuarios', {}, TIEMPO_ESPERA_MS);
                if (respuestaUsuarios.ok) {
                    const miembros = await respuestaUsuarios.json();
                    setNombres(Object.fromEntries(miembros.map((m) => [String(m.id), m.nombre || m.email])));
                }
            }
        } catch (error) {
            console.log('No se pudo actualizar del servidor, usando datos del teléfono:', error?.message || error);
            setSinConexion(true);
        } finally {
            if (sesion?.comunidad_id) setAlcancias(obtenerAlcanciasLocales(sesion.comunidad_id));
            setCargando(false);
            setRefrescando(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            cargar();
        }, [])
    );

    const onRefresh = () => {
        setRefrescando(true);
        cargar();
    };

    const estadisticas = useMemo(() => {
        const conteo = { Colocada: 0, Devuelta: 0, Faltante: 0 };
        let total = 0;
        let sinSubir = 0;
        const porUsuario = new Map();

        alcancias.forEach((a) => {
            const estado = obtenerEstado(a);
            const monto = Number(a.monto_entregado) || 0;
            conteo[estado] += 1;
            total += monto;
            if (a.sync_status !== 'synced') sinSubir += 1;

            const clave = String(a.usuario_id ?? '');
            const fila = porUsuario.get(clave) || { usuario_id: clave, registradas: 0, devueltas: 0, monto: 0 };
            fila.registradas += 1;
            if (estado === 'Devuelta') fila.devueltas += 1;
            fila.monto += monto;
            porUsuario.set(clave, fila);
        });

        const rangoInicio = usuario?.rango_inicio != null ? Number(usuario.rango_inicio) : null;
        const rangoFin = usuario?.rango_fin != null ? Number(usuario.rango_fin) : null;
        const totalRango = rangoInicio != null && rangoFin != null ? rangoFin - rangoInicio + 1 : null;

        return {
            registradas: alcancias.length,
            conteo,
            total,
            // Promedio de lo que entrega cada alcancía devuelta
            promedio: conteo.Devuelta > 0 ? total / conteo.Devuelta : 0,
            sinSubir,
            totalRango,
            porColaborador: [...porUsuario.values()].sort((a, b) => b.monto - a.monto)
        };
    }, [alcancias, usuario]);

    // El Excel se arma en el servidor y se descarga en el navegador del teléfono
    const exportarExcel = async () => {
        setExportando(true);
        try {
            // Primero se sube lo pendiente para que el Excel incluya todo
            await sincronizarPendientes();
            const respuesta = await fetchApi('/alcancias/exportar/enlace', { method: 'POST' }, TIEMPO_ESPERA_MS);
            const datos = await respuesta.json();
            if (!respuesta.ok) {
                Alert.alert('No se pudo exportar', datos.mensaje || datos.error || 'Intenta de nuevo.');
                return;
            }
            await Linking.openURL(`${API_URL}${datos.ruta}`);
        } catch (error) {
            Alert.alert('Sin conexión', 'Necesitas internet para exportar las alcancías a Excel.');
        } finally {
            setExportando(false);
        }
    };

    // Sin la lista de miembros (sin internet) no se sabe el nombre; si la hay y no aparece, ya salió
    const nombreColaborador = (usuario_id) => {
        if (nombres[usuario_id]) return nombres[usuario_id];
        if (String(usuario?.id) === usuario_id) return usuario?.nombre || 'Tú';
        return Object.keys(nombres).length > 0 ? 'Ex miembro' : `Colaborador #${usuario_id}`;
    };

    return {
        esAdmin,
        estadisticas,
        sinConexion,
        cargando,
        refrescando,
        onRefresh,
        exportando,
        exportarExcel,
        nombreColaborador
    };
};
