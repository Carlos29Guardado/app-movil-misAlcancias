import React from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAdministrarComunidad } from '../hooks/useAdministrarComunidad';

export default function AdministrarComunidadScreen() {
  const router = useRouter();

  const {
    comunidad,
    nombre, setNombre,
    cargando,
    error,
    guardandoNombre,
    regenerando,
    cambiandoEstado,
    cambiarEstado,
    guardarNombre,
    compartirCodigo,
    regenerarCodigo,
    reintentar
  } = useAdministrarComunidad();

  const nombreCambio = comunidad && nombre.trim() !== comunidad.nombre;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      {/* Encabezado */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.botonRegresar}>
          <Ionicons name="arrow-back" size={28} color="#C2DFE3" />
        </TouchableOpacity>
        <Text style={styles.tituloHeader}>Administrar Comunidad</Text>
        <View style={{ width: 28 }} />
      </View>

      {cargando ? (
        <View style={styles.centrado}>
          <ActivityIndicator size="large" color="#C2DFE3" />
        </View>
      ) : error ? (
        <View style={styles.centrado}>
          <Ionicons name="cloud-offline-outline" size={60} color="#3A4A50" />
          <Text style={styles.textoError}>{error}</Text>
          <TouchableOpacity style={styles.botonSecundario} onPress={reintentar}>
            <Text style={styles.textoBotonSecundario}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.contenido} keyboardShouldPersistTaps="handled">

          {/* Nombre de la comunidad */}
          <View style={styles.tarjeta}>
            <Text style={styles.tituloTarjeta}>Nombre de la comunidad</Text>
            <TextInput
              style={styles.input}
              value={nombre}
              onChangeText={setNombre}
              placeholder="Nombre de la comunidad"
              placeholderTextColor="#7A8C91"
              maxLength={60}
            />
            <TouchableOpacity
              style={[styles.botonPrincipal, (!nombreCambio || guardandoNombre) && styles.botonDeshabilitado]}
              onPress={guardarNombre}
              disabled={!nombreCambio || guardandoNombre}
            >
              {guardandoNombre ? (
                <ActivityIndicator color="#1E292D" />
              ) : (
                <Text style={styles.textoBotonPrincipal}>Guardar nombre</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Código de invitación */}
          <View style={styles.tarjeta}>
            <Text style={styles.tituloTarjeta}>Código de invitación</Text>
            <Text style={styles.descripcion}>Compártelo con los colaboradores para que se unan a la comunidad.</Text>
            <View style={styles.cajaCodigo}>
              <Text style={styles.codigo}>{comunidad?.codigo_invitacion}</Text>
            </View>
            <View style={styles.filaBotones}>
              <TouchableOpacity style={[styles.botonSecundario, styles.botonMitad]} onPress={compartirCodigo}>
                <Ionicons name="share-social-outline" size={20} color="#C2DFE3" />
                <Text style={styles.textoBotonSecundario}>Compartir</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.botonSecundario, styles.botonMitad, regenerando && styles.botonDeshabilitado]}
                onPress={regenerarCodigo}
                disabled={regenerando}
              >
                {regenerando ? (
                  <ActivityIndicator color="#C2DFE3" />
                ) : (
                  <>
                    <Ionicons name="refresh-outline" size={20} color="#C2DFE3" />
                    <Text style={styles.textoBotonSecundario}>Generar nuevo</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Resumen (solo lectura) */}
          <View style={styles.tarjeta}>
            <Text style={styles.tituloTarjeta}>Resumen</Text>
            <View style={styles.filaDato}>
              <Text style={styles.etiquetaDato}>Rango de alcancías</Text>
              <Text style={styles.valorDato}>{comunidad?.rango_inicio} a {comunidad?.rango_fin}</Text>
            </View>
            <View style={[styles.filaDato, { borderBottomWidth: 0 }]}>
              <Text style={styles.etiquetaDato}>Miembros</Text>
              <Text style={styles.valorDato}>{comunidad?.total_miembros}</Text>
            </View>
            {/* El avance, el dinero recaudado y el Excel están en Estadísticas */}
            <TouchableOpacity
              style={[styles.botonSecundario, { marginTop: 12 }]}
              onPress={() => router.push('/estadisticas' as any)}
            >
              <Ionicons name="stats-chart-outline" size={20} color="#C2DFE3" />
              <Text style={styles.textoBotonSecundario}>Ver estadísticas</Text>
            </TouchableOpacity>
          </View>

          {/* Lotes: qué números de alcancía se lleva cada colaborador */}
          <View style={styles.tarjeta}>
            <Text style={styles.tituloTarjeta}>Lotes por colaborador</Text>
            <Text style={styles.descripcion}>
              Asigna a cada colaborador los números de las alcancías que se lleva, para que nunca se repitan aunque registren sin internet.
            </Text>
            <TouchableOpacity style={styles.botonSecundario} onPress={() => router.push('/lotes' as any)}>
              <Ionicons name="albums-outline" size={20} color="#C2DFE3" />
              <Text style={styles.textoBotonSecundario}>Administrar lotes</Text>
            </TouchableOpacity>
          </View>

          {/* Estado de la campaña: cerrar la comunidad cuando termina (solo consulta) o reabrirla */}
          <View style={[styles.tarjeta, !comunidad?.activa && styles.tarjetaCerrada]}>
            <Text style={styles.tituloTarjeta}>Estado de la campaña</Text>
            <View style={styles.filaEstado}>
              <Ionicons
                name={comunidad?.activa ? 'radio-button-on' : 'lock-closed'}
                size={18}
                color={comunidad?.activa ? '#8FBC8F' : '#E0B15C'}
              />
              <Text style={[styles.textoEstado, { color: comunidad?.activa ? '#8FBC8F' : '#E0B15C' }]}>
                {comunidad?.activa
                  ? 'Activa'
                  : `Cerrada${comunidad?.fecha_cierre ? ` el ${new Date(comunidad.fecha_cierre).toLocaleDateString('es')}` : ''}`}
              </Text>
            </View>
            <Text style={styles.descripcion}>
              {comunidad?.activa
                ? 'Cuando la campaña termine (alcancías entregadas, recogidas y contadas), cierra la comunidad para guardar los datos como solo consulta.'
                : 'Nadie puede registrar ni editar alcancías ni unirse con el código. Los datos se conservan para consulta.'}
            </Text>
            <TouchableOpacity
              style={[
                comunidad?.activa ? styles.botonPeligro : styles.botonSecundario,
                cambiandoEstado && styles.botonDeshabilitado
              ]}
              onPress={() => cambiarEstado(!comunidad?.activa)}
              disabled={cambiandoEstado}
            >
              {cambiandoEstado ? (
                <ActivityIndicator color={comunidad?.activa ? '#C06C6C' : '#C2DFE3'} />
              ) : comunidad?.activa ? (
                <>
                  <Ionicons name="lock-closed-outline" size={20} color="#C06C6C" />
                  <Text style={styles.textoBotonPeligro}>Cerrar comunidad</Text>
                </>
              ) : (
                <>
                  <Ionicons name="lock-open-outline" size={20} color="#C2DFE3" />
                  <Text style={styles.textoBotonSecundario}>Reabrir comunidad</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#253237',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: '#1E292D',
  },
  botonRegresar: {
    padding: 5,
  },
  tituloHeader: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  centrado: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  textoError: {
    color: '#9AA8AC',
    fontSize: 16,
    marginTop: 15,
    marginBottom: 20,
    textAlign: 'center',
  },
  contenido: {
    padding: 20,
    paddingBottom: 40,
  },
  tarjeta: {
    backgroundColor: '#1E292D',
    borderRadius: 16,
    padding: 16,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#3A4A50',
  },
  tituloTarjeta: {
    color: '#C2DFE3',
    fontSize: 14,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
  },
  descripcion: {
    color: '#9AA8AC',
    fontSize: 14,
    marginBottom: 12,
  },
  input: {
    backgroundColor: '#253237',
    color: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#3A4A50',
  },
  botonPrincipal: {
    backgroundColor: '#C2DFE3',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  textoBotonPrincipal: {
    color: '#1E292D',
    fontSize: 16,
    fontWeight: 'bold',
  },
  botonDeshabilitado: {
    opacity: 0.5,
  },
  cajaCodigo: {
    backgroundColor: '#DDF0F2',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  codigo: {
    color: '#2A363B',
    fontSize: 26,
    fontWeight: 'bold',
    letterSpacing: 4,
  },
  filaBotones: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  botonSecundario: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#C2DFE3',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  botonMitad: {
    flex: 1,
    paddingHorizontal: 0,
  },
  textoBotonSecundario: {
    color: '#C2DFE3',
    fontSize: 15,
    fontWeight: '600',
  },
  tarjetaCerrada: {
    borderColor: 'rgba(224, 177, 92, 0.5)',
  },
  filaEstado: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  textoEstado: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  botonPeligro: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#C06C6C',
    borderRadius: 12,
    paddingVertical: 12,
  },
  textoBotonPeligro: {
    color: '#C06C6C',
    fontSize: 15,
    fontWeight: '600',
  },
  filaDato: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#253237',
  },
  etiquetaDato: {
    color: '#9AA8AC',
    fontSize: 15,
  },
  valorDato: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});
