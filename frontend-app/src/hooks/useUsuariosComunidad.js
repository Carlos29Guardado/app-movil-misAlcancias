import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchApi } from '../services/api';

// Tiempo máximo de espera al servidor
const TIEMPO_ESPERA_MS = 8000;

export const useUsuariosComunidad = () => {
    const [administradores, setAdministradores] = useState([]);
    const [colaboradores, setColaboradores] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [refrescando, setRefrescando] = useState(false);
    const [error, setError] = useState(null);

    // Función para obtener los usuarios de la comunidad desde el backend
    const cargarUsuarios = async () => {
        try {
            setError(null);
            const token = await AsyncStorage.getItem('userToken');
            if (!token) {
                setError('No se encontró la sesión del usuario.');
                return;
            }

            const respuesta = await fetchApi('/comunidad/usuarios', {}, TIEMPO_ESPERA_MS);

            const datos = await respuesta.json();

            if (!respuesta.ok) {
                setError(datos.mensaje || datos.error || 'No se pudieron cargar los usuarios.');
                return;
            }

            // El servidor ya los manda ordenados: primero el administrador, luego los colaboradores
            setAdministradores(datos.filter((u) => u.rol === 'admin'));
            setColaboradores(datos.filter((u) => u.rol !== 'admin'));
        } catch (err) {
            console.log('No se pudieron cargar los usuarios:', err?.message || err);
            setError('Necesitas conexión a internet para ver los usuarios de la comunidad.');
        } finally {
            setCargando(false);
            setRefrescando(false);
        }
    };

    // Se ejecuta automáticamente al abrir la pantalla
    useFocusEffect(
        useCallback(() => {
            cargarUsuarios();
        }, [])
    );

    // Función para jalar hacia abajo y recargar
    const onRefresh = () => {
        setRefrescando(true);
        cargarUsuarios();
    };

    // El admin le pasa la administración a un colaborador y él queda como colaborador
    const hacerAdministrador = (miembro) => {
        Alert.alert(
            'Hacer administrador',
            `${miembro.nombre || miembro.email} quedará a cargo de la comunidad (lotes, código de invitación, cerrar campaña) y tú quedarás como colaborador. ¿Continuar?`,
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Hacer administrador',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const respuesta = await fetchApi('/comunidad/admin', {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ usuario_id: miembro.id })
                            });
                            const datos = await respuesta.json();

                            if (!respuesta.ok) {
                                Alert.alert('No se pudo cambiar', datos.mensaje || 'Intenta de nuevo.');
                                return;
                            }

                            // Ya no es admin: se actualiza la sesión y se regresa al menú
                            const sesion = JSON.parse((await AsyncStorage.getItem('userData')) || '{}');
                            await AsyncStorage.setItem('userData', JSON.stringify({ ...sesion, rol: 'colaborador' }));
                            Alert.alert('Listo', datos.mensaje, [
                                { text: 'OK', onPress: () => router.replace('/explore') }
                            ], { cancelable: false });
                        } catch (err) {
                            Alert.alert('Sin conexión', 'Necesitas internet para cambiar el administrador.');
                        }
                    }
                }
            ]
        );
    };

    // El admin saca a un colaborador de la comunidad. Sus alcancías se quedan y sus lotes se liberan.
    const sacarDeComunidad = (miembro) => {
        const nombre = miembro.nombre || miembro.email;
        Alert.alert(
            'Sacar de la comunidad',
            `${nombre} ya no podrá registrar ni ver las alcancías de la comunidad. Las que ya subió se quedan y sus lotes quedan libres para asignarlos a otra persona.

Si tiene alcancías sin subir en su teléfono, se perderán: pídele que se conecte a internet antes.`,
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Sacar',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const respuesta = await fetchApi(`/comunidad/usuarios/${miembro.id}`, { method: 'DELETE' });
                            const datos = await respuesta.json();

                            if (!respuesta.ok) {
                                Alert.alert('No se pudo sacar', datos.mensaje || 'Intenta de nuevo.');
                                return;
                            }

                            setColaboradores((lista) => lista.filter((u) => u.id !== miembro.id));
                            Alert.alert('Listo', datos.mensaje);
                        } catch (err) {
                            Alert.alert('Sin conexión', 'Necesitas internet para sacar a alguien de la comunidad.');
                        }
                    }
                }
            ]
        );
    };

    // Opciones al tocar a un colaborador
    const mostrarOpciones = (miembro) => {
        Alert.alert(
            miembro.nombre || miembro.email,
            '¿Qué quieres hacer con este colaborador?',
            [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Sacar de la comunidad', style: 'destructive', onPress: () => sacarDeComunidad(miembro) },
                { text: 'Hacer administrador', onPress: () => hacerAdministrador(miembro) }
            ]
        );
    };

    return {
        administradores,
        colaboradores,
        cargando,
        refrescando,
        error,
        onRefresh,
        mostrarOpciones
    };
};
