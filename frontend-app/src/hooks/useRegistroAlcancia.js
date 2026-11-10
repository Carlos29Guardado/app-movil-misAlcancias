import { useState, useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchApi, comunidadEstaActiva } from '../services/api';
import { guardarAlcanciaLocal, obtenerSiguienteCodigoLocal, tieneCambiosPendientes } from '../../database/sqlite';
import { sincronizarPendientes } from './useSincronizacion';
import { refrescarMisLotes, siguienteNumeroDelUsuario, numeroEnLotes, describirLotes } from '../services/lotes';

export const useRegistroAlcancia = () => {
    const [numeroAlcancia, setNumeroAlcancia] = useState('');
    const [rangoInicio, setRangoInicio] = useState(null);
    const [rangoFin, setRangoFin] = useState(null);
    const [cargandoInicial, setCargandoInicial] = useState(true);
    // Lotes: si la comunidad los usa, el número sale solo de los lotes asignados a este colaborador
    const [modoLotes, setModoLotes] = useState(false);
    const [lotes, setLotes] = useState([]);

    const [nombrePersona, setNombrePersona] = useState('');
    const [guardando, setGuardando] = useState(false);
    //Candado para que un doble toque rápido no registre la misma alcancía dos veces
    const registrando = useRef(false);

    useEffect(() => {
        const obtenerDatosSector = async () => {
            try {
                const usuarioString = await AsyncStorage.getItem('userData');
                if (!usuarioString) return;

                // Con internet se actualizan los lotes; sin internet se usan los guardados en la sesión
                const usuario = (await refrescarMisLotes()) || JSON.parse(usuarioString);

                if (usuario.rango_inicio) setRangoInicio(Number(usuario.rango_inicio));
                if (usuario.rango_fin) setRangoFin(Number(usuario.rango_fin));

                if (usuario.usa_lotes) {
                    // El número libre más bajo de SUS lotes: nadie más usa esos números, así que no se repite
                    setModoLotes(true);
                    setLotes(usuario.lotes || []);
                    const siguiente = siguienteNumeroDelUsuario(usuario);
                    setNumeroAlcancia(siguiente != null ? String(siguiente) : '');
                    return;
                }

                // Sin lotes: número automático de toda la comunidad (como antes)
                const inicioSector = usuario.rango_inicio || 1;

                const siguienteLocal = obtenerSiguienteCodigoLocal(usuario.comunidad_id, inicioSector);

                try {
                    const respuesta = await fetchApi(`/alcancias/siguiente/${usuario.comunidad_id}`, {}, 8000);
                    if (respuesta.ok) {
                        const data = await respuesta.json();

                        // Guardamos el rango en la sesión para poder validar el número sin conexión
                        // (al crear o unirse a una comunidad el rango no se guarda hasta el siguiente login)
                        if (data.rango_inicio != null && data.rango_fin != null) {
                            setRangoInicio(Number(data.rango_inicio));
                            setRangoFin(Number(data.rango_fin));
                            await AsyncStorage.setItem('userData', JSON.stringify({
                                ...usuario,
                                rango_inicio: data.rango_inicio,
                                rango_fin: data.rango_fin
                            }));
                        }

                        if (data.limite_alcanzado) {
                            // Ya no quedan números en el rango de la comunidad
                            setNumeroAlcancia('');
                        } else {
                            const numeroFinal = Math.max(data.siguiente_codigo, siguienteLocal);
                            setNumeroAlcancia(numeroFinal.toString());
                        }
                    } else {
                        setNumeroAlcancia(siguienteLocal.toString());
                    }
                } catch (networkError) {
                    setNumeroAlcancia(siguienteLocal.toString());
                }
            } catch (error) {
                console.error('Erro al inicializar la pantalla:', error);
            } finally {
                setCargandoInicial(false);
            }
        };
        obtenerDatosSector();
    }, []);
    const manejarRegistro = async () => {
    if (registrando.current) return;
    registrando.current = true;
    setGuardando(true);

    try {

      const usuarioString = await AsyncStorage.getItem('userData');

      if (!usuarioString) {
        Alert.alert('Error de Sesión', 'No se encontraron datos del usuario');
        return;
      }

      const usuario = JSON.parse(usuarioString);

      if (!comunidadEstaActiva(usuario)) {
        Alert.alert('Comunidad cerrada', 'La campaña terminó: ya no se pueden registrar alcancías en esta comunidad.');
        return;
      }

      // Con lotes: solo se registra dentro de los lotes asignados a este colaborador
      if (usuario.usa_lotes) {
        if (!usuario.lotes || usuario.lotes.length === 0) {
          Alert.alert('Sin lote asignado', 'Pide al administrador que te asigne un lote de alcancías para poder registrar.');
          return;
        }
        if (!numeroAlcancia) {
          Alert.alert('Lote completo', `Ya usaste todos los números de tus lotes (${describirLotes(usuario.lotes)}). Pide al administrador un lote nuevo.`);
          return;
        }
        if (!numeroEnLotes(Number(numeroAlcancia), usuario.lotes)) {
          Alert.alert('Fuera de tu lote', `El número ${numeroAlcancia} no está en tus lotes (${describirLotes(usuario.lotes)}).`);
          return;
        }
      }

      // El número se calcula automáticamente; si está vacío es que ya se usó todo el rango
      const codigo = Number(numeroAlcancia);
      if (!numeroAlcancia || !Number.isInteger(codigo)) {
        Alert.alert('Sin números disponibles', 'Ya se registraron todas las alcancías del rango de tu comunidad.');
        return;
      }
      if (rangoInicio != null && rangoFin != null && (codigo < rangoInicio || codigo > rangoFin)) {
        Alert.alert(
          'Fuera de rango',
          `El número ${codigo} no pertenece a tu comunidad. Las alcancías de tu comunidad van de la ${rangoInicio} a la ${rangoFin}.`
        );
        return;
      }

      // No se permite registrar sin el nombre de la persona a quien se entrega
      const nombre = nombrePersona.trim();
      if (nombre.length < 2) {
        Alert.alert('Falta el nombre', 'Escribe el nombre de la persona a quien se le entrega la alcancía.');
        return;
      }

      const payload = {
        codigo_alcancia: codigo,
        nombre_persona: nombre,
        comunidad_id: usuario.comunidad_id,
        usuario_id: usuario.id,
        // Al registrar, la alcancía apenas se entrega: siempre queda Colocada y sin monto.
        // El estado y el monto se capturan después, al editarla cuando se recoge.
        colocada: 1,
        devuelta: 0,
        faltante: 0,
        monto_entregado: null,
      };

      const resultadoLocal = guardarAlcanciaLocal(payload);

      if (resultadoLocal && resultadoLocal.exito) {
        // Si hay internet se sube de una vez, para que los demás la vean en su lista;
        // si no, queda guardada en el teléfono y se sube sola al volver la conexión
        await sincronizarPendientes();
        const subida = !tieneCambiosPendientes(codigo);

        Alert.alert(
          subida ? 'Registrada' : 'Guardada sin conexión',
          subida
            ? `Alcancía #${codigo} registrada y subida al servidor.`
            : `Alcancía #${codigo} guardada en el teléfono. Se subirá automáticamente cuando haya conexión.`,
          [{
            text: 'Siguiente',
            onPress: () => {
              setNombrePersona('');
              if (usuario.usa_lotes) {
                // Siguiente número libre de sus lotes (ya cuenta el que se acaba de guardar)
                const siguiente = siguienteNumeroDelUsuario(usuario);
                setNumeroAlcancia(siguiente != null ? String(siguiente) : '');
                return;
              }
              // Sugerimos el siguiente número, sin pasarnos del rango
              const siguienteNumero = codigo + 1;
              setNumeroAlcancia(rangoFin != null && siguienteNumero > rangoFin ? '' : siguienteNumero.toString());
            }
          }]
        );
      } else {
        Alert.alert('Error', resultadoLocal?.error || 'No se pudo guardar el registro localmente.');
      }
    } catch (error) {
      console.error('Error al registrar la alcancía:', error);
      Alert.alert('Error', 'Ocurrió un problema al registrar la alcancía. Intenta de nuevo.');
    } finally {
      registrando.current = false;
      setGuardando(false);
    }
  };

    return {
        numeroAlcancia,
        rangoInicio,
        rangoFin,
        modoLotes,
        lotes,
        nombrePersona, setNombrePersona,
        cargandoInicial,
        guardando,
        manejarRegistro
    };



}