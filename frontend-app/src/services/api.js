import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import { API_URL } from '../../config/config';
import { borrarDatosLocales } from '../../database/sqlite';

// Tiempo máximo de espera por defecto para cada petición
const TIEMPO_ESPERA_MS = 10000;

// Evita mostrar el aviso de sesión vencida varias veces seguidas
let avisoSesionMostrado = false;

// El token venció: se quita solo el token (los datos del usuario y los cambios
// pendientes en SQLite se conservan) y se pide volver a iniciar sesión para subirlos.
const avisarSesionVencida = async () => {
    if (avisoSesionMostrado) return;
    avisoSesionMostrado = true;

    await AsyncStorage.removeItem('userToken');

    Alert.alert(
        'Sesión vencida',
        'Tu sesión expiró. Tus cambios siguen guardados en el teléfono; inicia sesión de nuevo para subirlos al servidor.',
        [{
            text: 'Iniciar sesión',
            onPress: () => {
                avisoSesionMostrado = false;
                router.replace('/');
            }
        }],
        { cancelable: false }
    );
};

// Guarda en la sesión si la comunidad está activa o cerrada (campaña finalizada).
// Con este dato la app funciona en modo "solo consulta" aunque no haya internet.
export const guardarEstadoComunidad = async (activa) => {
    const usuarioString = await AsyncStorage.getItem('userData');
    if (!usuarioString) return;
    await AsyncStorage.setItem('userData', JSON.stringify({ ...JSON.parse(usuarioString), comunidad_activa: activa }));
};

// Quita de la sesión todo lo de la comunidad (al abandonarla). Se conservan los datos de la cuenta.
export const quitarComunidadDeSesion = async () => {
    const usuarioString = await AsyncStorage.getItem('userData');
    if (!usuarioString) return;
    const {
        comunidad_id, comunidad_nombre, comunidad_codigo, rango_inicio, rango_fin,
        comunidad_activa, usa_lotes, lotes, lotes_usados_servidor,
        ...cuenta
    } = JSON.parse(usuarioString);
    await AsyncStorage.setItem('userData', JSON.stringify({ ...cuenta, rol: 'colaborador', comunidad_id: null }));
};

// La comunidad está activa salvo que se haya marcado explícitamente como cerrada
export const comunidadEstaActiva = (usuario) => usuario?.comunidad_activa !== false;

// Evita repetir el aviso de comunidad cerrada en cada petición
let avisoCierreMostrado = false;

const avisarComunidadCerrada = async () => {
    await guardarEstadoComunidad(false);
    if (avisoCierreMostrado) return;
    avisoCierreMostrado = true;
    Alert.alert(
        'Comunidad cerrada',
        'El administrador cerró la comunidad porque la campaña terminó. Puedes consultar las alcancías, pero ya no registrar ni editar. Si tenías cambios sin subir, se quedan guardados en el teléfono por si la comunidad se reabre.'
    );
};

// Evita repetir el aviso de que el admin sacó al usuario de la comunidad
let avisoSalidaMostrado = false;

// El administrador sacó al usuario de la comunidad desde otro teléfono: se borra lo de esa
// comunidad del teléfono (ya no se puede subir) y se regresa a la bienvenida para unirse a otra.
const avisarSacadoDeComunidad = async () => {
    const usuario = JSON.parse((await AsyncStorage.getItem('userData')) || '{}');
    // Si ya no tenía comunidad en la sesión (por ejemplo, acaba de abandonarla) no hay nada que avisar
    if (!usuario.comunidad_id || avisoSalidaMostrado) return;
    avisoSalidaMostrado = true;

    borrarDatosLocales();
    await quitarComunidadDeSesion();

    Alert.alert(
        'Ya no perteneces a la comunidad',
        'El administrador te sacó de la comunidad. Las alcancías que registraste se quedan en ella. Para volver, pídele un código de invitación.',
        [{
            text: 'OK',
            onPress: () => {
                avisoSalidaMostrado = false;
                router.replace('/bienvenida');
            }
        }],
        { cancelable: false }
    );
};

// Pregunta al servidor si la comunidad sigue activa y cuál es el rol actual del usuario,
// y lo guarda en la sesión. El rol puede cambiar desde otro teléfono (al hacerlo administrador).
// Devuelve la sesión actualizada, o null si no se pudo consultar (sin internet).
export const refrescarEstadoComunidad = async () => {
    try {
        const respuesta = await fetchApi('/comunidad/estado', {}, 6000);
        if (!respuesta.ok) return null;
        const { activa, rol } = await respuesta.json();

        const usuario = JSON.parse((await AsyncStorage.getItem('userData')) || '{}');
        const actualizado = {
            ...usuario,
            comunidad_activa: activa,
            // Un servidor anterior no manda el rol: en ese caso se conserva el guardado
            ...(rol ? { rol } : {})
        };
        await AsyncStorage.setItem('userData', JSON.stringify(actualizado));

        if (activa) avisoCierreMostrado = false;
        return actualizado;
    } catch (error) {
        return null;
    }
};

// fetch hacia la API con el token de sesión y un tiempo máximo de espera.
// `ruta` es relativa a API_URL, por ejemplo '/alcancias/sincronizar'.
export const fetchApi = async (ruta, opciones = {}, tiempoMs = TIEMPO_ESPERA_MS) => {
    const token = await AsyncStorage.getItem('userToken');

    // Cortamos la petición si el servidor tarda demasiado (red lenta o sin salida a internet)
    const controlador = new AbortController();
    const temporizador = setTimeout(() => controlador.abort(), tiempoMs);

    const respuesta = await fetch(`${API_URL}${ruta}`, {
        ...opciones,
        headers: {
            ...(opciones.headers || {}),
            ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        signal: controlador.signal
    }).finally(() => clearTimeout(temporizador));

    // verificarToken responde 403 "Token inválido o expirado." cuando el token ya no sirve
    if (token && respuesta.status === 403) {
        const cuerpo = await respuesta.clone().json().catch(() => ({}));
        if (String(cuerpo.error || '').includes('Token')) {
            avisarSesionVencida();
        } else if (cuerpo.comunidad_cerrada) {
            avisarComunidadCerrada();
        } else if (cuerpo.sin_comunidad) {
            avisarSacadoDeComunidad();
        }
    }

    return respuesta;
};
