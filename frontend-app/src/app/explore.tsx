import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Modal, TouchableWithoutFeedback } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Updates from 'expo-updates';
import { contarPendientes, borrarDatosLocales } from '../../database/sqlite';
import { sincronizarPendientes } from '../hooks/useSincronizacion';
import { comunidadEstaActiva, refrescarEstadoComunidad } from '../services/api';
import { refrescarMisLotes } from '../services/lotes';

export default function MenuPrincipalScreen() {
  const [usuario, setUsuario] = useState<any>(null);
  const [cargando, setCargando] = useState(true);
  const [modalVisible, setModalVisible] = useState(false); // Agregado para controlar el modal

  // Se vuelve a leer la sesión cada vez que se regresa al menú (por ejemplo, tras cambiar el nombre de la comunidad)
  useFocusEffect(useCallback(() => {
    const cargarSesion = async () => {
      try {
        const usuarioString = await AsyncStorage.getItem('userData');
        if (usuarioString) {
          const usuarioParseado = JSON.parse(usuarioString);
          console.log("Datos exactos en AsyncStorage:", usuarioParseado);
          setUsuario(usuarioParseado);

          // Si hay internet, revisamos si el admin cerró o reabrió la comunidad
          if (usuarioParseado.comunidad_id) {
            // Estado de la comunidad y rol actual: si otro teléfono lo hizo admin, aquí se actualiza el menú
            const actualizado = await refrescarEstadoComunidad();
            if (actualizado) setUsuario(actualizado);
            // También guardamos sus lotes, para poder registrar después aunque no haya señal
            await refrescarMisLotes();
          }
        } else {
          console.log("El AsyncStorage está completamente vacío.");
        }
      } catch (error) {
        console.error('Error leyendo la sesión:', error);
      } finally {
        setCargando(false);
      }
    };

    cargarSesion();
  }, []));

  const manejarCerrarSesion = async () => {
    // Antes de salir intentamos subir lo pendiente (si no hay red, regresa de inmediato)
    await sincronizarPendientes();
    const pendientes = contarPendientes();

    Alert.alert(
      'Cerrar Sesión',
      pendientes > 0
        ? `Tienes ${pendientes} ${pendientes === 1 ? 'cambio' : 'cambios'} sin subir al servidor. Si cierras sesión ahora se borrarán de este teléfono y se perderán.\n\nConéctate a internet y espera a que se suban antes de salir.`
        : '¿Estás seguro de que quieres salir?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: pendientes > 0 ? 'Salir y borrar' : 'Si, salir',
          style: 'destructive',
          onPress: async () => {
            try {
              // Se borran los datos locales para que otra cuenta no suba los de esta
              borrarDatosLocales();
              await AsyncStorage.removeItem('userData');
              await AsyncStorage.removeItem('userToken');
              setModalVisible(false);
              router.replace('/'); // O la ruta principal de tu login
            } catch (error) {
              console.error('Error al limpiar la sesion:', error);
            }
          }
        }
      ]
    )
  }

  // Abre la pantalla para salir de la comunidad (sube pendientes y, si es admin, elige sucesor)
  const manejarSalirComunidad = () => {
    setModalVisible(false);
    router.push('/abandonar_comunidad' as any);
  };

  if (cargando) {

    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#C2DFE3" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.saludo}>
              ¡Hola, {usuario?.nombre ? usuario.nombre.split(' ')[0] : 'Voluntario'}!
            </Text>
            <Text style={styles.subtitulo}>
              {usuario?.comunidad_nombre
                ? usuario.comunidad_nombre
                : `Sector #${usuario?.comunidad_id || 'Sin asignar'}`}
            </Text>
          </View>
          {/* Se agregó onPress para abrir el modal */}
          <TouchableOpacity style={styles.avatar} onPress={() => setModalVisible(true)}>
            <Ionicons name="person" size={28} color="#253237" />
          </TouchableOpacity>
        </View>

        <View style={styles.modulosContainer}>
          {/* Comunidad cerrada: la campaña terminó y todo queda solo para consulta */}
          {!comunidadEstaActiva(usuario) && (
            <View style={styles.avisoCerrada}>
              <Ionicons name="lock-closed-outline" size={20} color="#E0B15C" />
              <Text style={styles.textoAvisoCerrada}>
                Comunidad cerrada: la campaña terminó. Puedes consultar las alcancías, pero ya no registrar ni editar.
              </Text>
            </View>
          )}

          {/* Tarjeta 1: Registro (Visible para todos; deshabilitada si la comunidad está cerrada) */}
          <TouchableOpacity
            style={[styles.tarjeta, !comunidadEstaActiva(usuario) && { opacity: 0.4 }]}
            onPress={() => {
              if (!comunidadEstaActiva(usuario)) {
                Alert.alert('Comunidad cerrada', 'La campaña terminó: ya no se pueden registrar alcancías.');
                return;
              }
              router.push('/registro_alcancia');
            }}
          >
            <View style={styles.iconoContainer}>
              <Ionicons name="add-circle" size={32} color="#C2DFE3" />
            </View>
            <View style={styles.tarjetaTexto}>
              <Text style={styles.tarjetaTitulo}>Registrar Alcancía</Text>
              <Text style={styles.tarjetaDesc}>Ingresa una nueva donación</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#C2DFE3" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.tarjeta}
            onPress={() => router.push('/lista' as any)}
          >
            <View style={styles.iconoContainer}>
              <Ionicons name="list" size={32} color="#C2DFE3" />
            </View>
            <View style={styles.tarjetaTexto}>
              <Text style={styles.tarjetaTitulo}>Lista de Alcancías</Text>
              <Text style={styles.tarjetaDesc}>Revisa el historial y totales</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#C2DFE3" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.tarjeta}
            onPress={() => router.push('/estadisticas' as any)}
          >
            <View style={styles.iconoContainer}>
              <Ionicons name="stats-chart" size={32} color="#C2DFE3" />
            </View>
            <View style={styles.tarjetaTexto}>
              <Text style={styles.tarjetaTitulo}>Estadísticas</Text>
              <Text style={styles.tarjetaDesc}>
                {usuario?.rol === 'admin' ? 'Total recaudado y exportar a Excel' : 'Total recaudado y avance'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#C2DFE3" />
          </TouchableOpacity>

          {usuario?.rol === 'admin' && (
            <TouchableOpacity
              style={styles.tarjeta}
              onPress={() => router.push('/usuarios' as any)}
            >
              <View style={styles.iconoContainer}>
                <Ionicons name="people" size={32} color="#C2DFE3" />
              </View>
              <View style={styles.tarjetaTexto}>
                <Text style={styles.tarjetaTitulo}>Usuarios</Text>
                <Text style={styles.tarjetaDesc}>Administra los voluntarios</Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color="#C2DFE3" />
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)} // Esto permite cerrarlo con el botón físico de "Atrás" en Android
      >
        {/* El overlay ahora es un botón que al tocarlo cierra el modal */}
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPressOut={() => setModalVisible(false)}
        >
          {/* TouchableWithoutFeedback evita que tocar el menú por dentro lo cierre */}
          <TouchableWithoutFeedback>
            <View style={styles.modalContent}>

              {/* ESTO ES NUEVO: La rayita visual del "gesto" */}
              <View style={styles.indicadorGesto} />

              <View style={styles.modalAvatarContainer}>
                <Ionicons name="person" size={50} color="#C2DFE3" />
              </View>
              <Text style={styles.modalNombre}>{usuario?.nombre}</Text>
              <Text style={styles.modalEmail}>{usuario?.email}</Text>
              <Text style={styles.modalRol}>
                {usuario?.rol === 'admin' ? 'Administrador' : 'Colaborador'}
              </Text>
              <View style={{ width: '100%', marginTop: 10 }}>
                {/* Solo el administrador: nombre, código de invitación y resumen de la comunidad */}
                {usuario?.rol === 'admin' && (
                  <>
                    <TouchableOpacity
                      style={styles.botonAccion}
                      onPress={() => {
                        setModalVisible(false);
                        router.push('/administrar_comunidad' as any);
                      }}
                    >
                      <Ionicons name="settings-outline" size={24} color="#C2DFE3" />
                      <Text style={[styles.textoBotonAccion, { color: '#C2DFE3' }]}>Administrar Comunidad</Text>
                    </TouchableOpacity>

                    <View style={styles.separador} />
                  </>
                )}

                <TouchableOpacity style={styles.botonAccion} onPress={manejarSalirComunidad}>
                  <Ionicons name="exit-outline" size={24} color="#C06C6C" />
                  <Text style={[styles.textoBotonAccion, { color: '#C06C6C' }]}>Abandonar Comunidad</Text>
                </TouchableOpacity>

                <View style={styles.separador} />

                <TouchableOpacity style={styles.botonAccion} onPress={manejarCerrarSesion}>
                  <Ionicons name="log-out-outline" size={24} color="#C06C6C" />
                  <Text style={[styles.textoBotonAccion, { color: '#C06C6C' }]}>Cerrar Sesión</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.botonCerrarModal, { marginTop: 25 }]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.textoBotonCerrar}>Volver al Menú</Text>
              </TouchableOpacity>

              {/* Identificador de la actualización instalada (EAS Update), para saber qué versión tiene el teléfono */}
              <Text style={styles.textoVersion}>
                Versión: {Updates.updateId ? Updates.updateId.slice(0, 8) : 'integrada en el APK'}
              </Text>

            </View>
          </TouchableWithoutFeedback>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#253237',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 30,
    backgroundColor: '#1E292D',
    borderBottomLeftRadius: 25,
    borderBottomRightRadius: 25,
  },
  saludo: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  subtitulo: {
    fontSize: 14,
    color: '#C2DFE3',
    marginTop: 4,
  },
  avatar: {
    width: 50,
    height: 50,
    backgroundColor: '#C2DFE3',
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modulosContainer: {
    padding: 20,
    marginTop: 10,
  },
  avisoCerrada: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    marginBottom: 15,
    borderRadius: 14,
    backgroundColor: 'rgba(224, 177, 92, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(224, 177, 92, 0.4)',
  },
  textoAvisoCerrada: {
    color: '#E0B15C',
    fontSize: 14,
    flex: 1,
  },
  tarjeta: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E292D',
    padding: 20,
    borderRadius: 16,
    marginBottom: 15,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  iconoContainer: {
    width: 50,
    height: 50,
    backgroundColor: '#253237',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  tarjetaTexto: {
    flex: 1,
  },
  tarjetaTitulo: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF', // Letras blancas
  },
  tarjetaDesc: {
    fontSize: 13,
    color: '#9AA8AC', // Un tono gris-azulado sutil para la descripción
    marginTop: 2,
  },
  botonAccion: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 10,
  },
  textoBotonAccion: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 15,
  },
  separador: {
    height: 1,
    backgroundColor: '#253237', // Línea separadora oscura
    width: '100%',
  },
  // ESTILOS DEL MODAL FALTANTES
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)', // Un poco más oscuro para resaltar el modal
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1E292D', // Fondo oscuro igual al de la cabecera de la app
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 30,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 10,
  },
  modalAvatarContainer: {
    width: 100,
    height: 100,
    backgroundColor: '#253237', // Fondo del círculo oscuro
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  modalNombre: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF', // Letra blanca
  },
  modalEmail: {
    fontSize: 14,
    color: '#C2DFE3', // Celeste sutil
    marginBottom: 5,
  },
  modalRol: {
    fontSize: 14,
    color: '#1E292D',
    fontWeight: 'bold',
    backgroundColor: '#C2DFE3', // Invertimos los colores para que resalte como etiqueta
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 10,
    marginBottom: 25,
  },
  botonCerrarModal: {
    backgroundColor: '#C2DFE3', // Mismo color del botón Log In
    width: '100%',
    padding: 15,
    borderRadius: 25, // Bordes más redondeados tipo pastilla
    alignItems: 'center',
    marginTop: 15, // Espacio superior en lugar de margin bottom
  },
  textoBotonCerrar: {
    color: '#1E292D', // Texto oscuro para contrastar con el fondo celeste
    fontWeight: 'bold',
    fontSize: 16,
  },
  textoVersion: {
    color: '#5F6F74',
    fontSize: 12,
    marginTop: 14,
  },
  indicadorGesto: {
    width: 40,
    height: 5,
    backgroundColor: '#253237', 
    borderRadius: 3,
    marginBottom: 20,
    alignSelf: 'center', 
  },

});