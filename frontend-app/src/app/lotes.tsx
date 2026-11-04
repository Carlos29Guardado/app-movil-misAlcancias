import React from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useLotes } from '../hooks/useLotes';

export default function LotesScreen() {
  const router = useRouter();

  const {
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
    reintentar
  } = useLotes();

  const cantidad = desde && hasta && Number(hasta) >= Number(desde) ? Number(hasta) - Number(desde) + 1 : null;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      {/* Encabezado */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.botonRegresar}>
          <Ionicons name="arrow-back" size={28} color="#C2DFE3" />
        </TouchableOpacity>
        <Text style={styles.tituloHeader}>Lotes por colaborador</Text>
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

          <Text style={styles.explicacion}>
            Asigna a cada colaborador los números de las alcancías que se lleva. La app solo usará esos números
            al registrar, así nunca se repiten aunque trabajen sin internet.
            {datos?.rango_inicio != null && datos?.rango_fin != null
              ? `\nRango de la comunidad: ${datos.rango_inicio} a ${datos.rango_fin}.`
              : ''}
          </Text>

          {/* Asignar un lote nuevo (solo si quedan números sin repartir) */}
          {libres == null ? (
            <View style={styles.tarjeta}>
              <Text style={styles.tituloTarjeta}>Asignar lote</Text>
              <Text style={styles.sinLotes}>
                Ya se repartieron todas las alcancías del rango de la comunidad. Para dar otro lote, quita uno que
                todavía no tenga alcancías registradas.
              </Text>
            </View>
          ) : (
          <View style={styles.tarjeta}>
            <Text style={styles.tituloTarjeta}>Asignar lote</Text>

            <Text style={styles.etiqueta}>Colaborador</Text>
            <View style={styles.chips}>
              {datos?.miembros.map((m: any) => (
                <TouchableOpacity
                  key={m.id}
                  style={[styles.chip, usuarioSeleccionado === m.id && styles.chipActivo]}
                  onPress={() => setUsuarioSeleccionado(m.id)}
                >
                  <Text style={[styles.textoChip, usuarioSeleccionado === m.id && styles.textoChipActivo]}>
                    {m.nombre || m.email}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.filaRango}>
              <View style={styles.campoRango}>
                <Text style={styles.etiqueta}>Desde</Text>
                <TextInput
                  style={styles.input}
                  value={desde}
                  onChangeText={(t) => setDesde(t.replace(/[^0-9]/g, ''))}
                  keyboardType="number-pad"
                  placeholder={libres?.inicio != null ? String(libres.inicio) : ''}
                  placeholderTextColor="#7A8C91"
                />
              </View>
              <View style={styles.campoRango}>
                <Text style={styles.etiqueta}>Hasta</Text>
                <TextInput
                  style={styles.input}
                  value={hasta}
                  onChangeText={(t) => setHasta(t.replace(/[^0-9]/g, ''))}
                  keyboardType="number-pad"
                  placeholder={libres?.fin != null ? String(libres.fin) : ''}
                  placeholderTextColor="#7A8C91"
                />
              </View>
            </View>
            {cantidad != null && <Text style={styles.ayuda}>{cantidad} alcancías</Text>}
            {libres?.fin != null && (
              <Text style={styles.ayuda}>
                Números libres: {libres.inicio} a {libres.fin} ({libres.fin - (libres.inicio ?? 0) + 1} alcancías)
              </Text>
            )}

            <TouchableOpacity
              style={[styles.botonPrincipal, guardando && styles.botonDeshabilitado]}
              onPress={asignarLote}
              disabled={guardando}
            >
              {guardando ? (
                <ActivityIndicator color="#1E292D" />
              ) : (
                <Text style={styles.textoBotonPrincipal}>Asignar lote</Text>
              )}
            </TouchableOpacity>
          </View>
          )}

          {/* Lotes de cada miembro */}
          {datos?.miembros.map((m: any) => (
            <View key={m.id} style={styles.tarjeta}>
              <View style={styles.filaMiembro}>
                <Text style={styles.nombreMiembro}>{m.nombre || m.email}</Text>
                <Text style={styles.rolMiembro}>{m.rol === 'admin' ? 'Admin' : 'Colaborador'}</Text>
              </View>

              {m.lotes.length === 0 ? (
                <Text style={styles.sinLotes}>Sin lote asignado: no puede registrar alcancías.</Text>
              ) : (
                m.lotes.map((l: any) => (
                  <View key={l.id} style={styles.filaLote}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rangoLote}>{l.rango_inicio} a {l.rango_fin}</Text>
                      <Text style={styles.usoLote}>{l.usados} de {l.total} registradas</Text>
                    </View>
                    <TouchableOpacity onPress={() => eliminarLote(l, m.nombre || m.email)} style={styles.botonQuitar}>
                      <Ionicons name="trash-outline" size={20} color="#C06C6C" />
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </View>
          ))}

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
  explicacion: {
    color: '#9AA8AC',
    fontSize: 14,
    marginBottom: 15,
    lineHeight: 20,
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
  etiqueta: {
    color: '#C2DFE3',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#3A4A50',
    backgroundColor: '#253237',
  },
  chipActivo: {
    backgroundColor: '#C2DFE3',
    borderColor: '#C2DFE3',
  },
  textoChip: {
    color: '#9AA8AC',
    fontSize: 14,
    fontWeight: '600',
  },
  textoChipActivo: {
    color: '#1E292D',
  },
  filaRango: {
    flexDirection: 'row',
    gap: 10,
  },
  campoRango: {
    flex: 1,
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
  ayuda: {
    color: '#9AA8AC',
    fontSize: 12,
    marginTop: 6,
  },
  botonPrincipal: {
    backgroundColor: '#C2DFE3',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 14,
  },
  textoBotonPrincipal: {
    color: '#1E292D',
    fontSize: 16,
    fontWeight: 'bold',
  },
  botonDeshabilitado: {
    opacity: 0.5,
  },
  botonSecundario: {
    borderWidth: 1,
    borderColor: '#C2DFE3',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  textoBotonSecundario: {
    color: '#C2DFE3',
    fontSize: 15,
    fontWeight: '600',
  },
  filaMiembro: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  nombreMiembro: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  rolMiembro: {
    color: '#9AA8AC',
    fontSize: 12,
  },
  sinLotes: {
    color: '#C06C6C',
    fontSize: 13,
  },
  filaLote: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#253237',
  },
  rangoLote: {
    color: '#C2DFE3',
    fontSize: 15,
    fontWeight: 'bold',
  },
  usoLote: {
    color: '#9AA8AC',
    fontSize: 12,
    marginTop: 2,
  },
  botonQuitar: {
    padding: 8,
  },
});
