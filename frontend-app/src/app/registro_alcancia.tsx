import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from 'react-native';
import { useRegistroAlcancia } from '../hooks/useRegistroAlcancia'; // Ajusta la ruta
import { describirLotes } from '../services/lotes';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

export default function RegistrarAlcanciaScreen() {

  const opcionesEstado = ['Colocada', 'Devuelta', 'Faltante'];
  const {
    numeroAlcancia,
    rangoInicio,
    rangoFin,
    modoLotes,
    lotes,
    nombrePersona, setNombrePersona,
    cargandoInicial,
    guardando,
    manejarRegistro
  } = useRegistroAlcancia();

  if (cargandoInicial) {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" color="#0000ff" />
    </View>
  );
}

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.botonRegresar}>
          <Ionicons name="arrow-back" size={28} color="#C2DFE3" />
        </TouchableOpacity>
        <Text style={styles.tituloHeader}>Registrar Ingreso</Text>
        <View style={{ width: 28 }} />
      </View>

      {/* Cambiamos a ScrollView por si el teclado tapa los campos */}
      <ScrollView style={styles.formContainer}>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Número de Alcancía (Automático)</Text>
          <TextInput
            style={[styles.input, styles.inputBloqueado]}
            value={numeroAlcancia}
            editable={false} // Bloquea la edición: se calcula con el rango de la comunidad
          />
          {modoLotes ? (
            lotes.length > 0 ? (
              <Text style={styles.ayuda}>
                {numeroAlcancia ? `Tus lotes: ${describirLotes(lotes)}` : `Ya usaste todos tus lotes (${describirLotes(lotes)}). Pide un lote nuevo al administrador.`}
              </Text>
            ) : (
              <Text style={styles.avisoLote}>No tienes un lote asignado. Pide al administrador que te asigne uno para poder registrar.</Text>
            )
          ) : (
            rangoInicio != null && rangoFin != null && (
              <Text style={styles.ayuda}>Rango de tu comunidad: {rangoInicio} a {rangoFin}</Text>
            )
          )}
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Nombre de quien recibe</Text>
          <TextInput
            style={styles.input}
            placeholder="Ej. María Pérez"
            placeholderTextColor="#9AA8AC"
            value={nombrePersona}
            onChangeText={setNombrePersona}
            autoCapitalize="words"
          />
        </View>

        {/* Al registrar la alcancía apenas se entrega: el estado es fijo y el monto se captura al recogerla */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Estado de la Alcancía</Text>
          <View style={styles.radioContainer}>
            {opcionesEstado.map((opcion) => (
              <View
                key={opcion}
                style={[
                  styles.radioBoton,
                  opcion === 'Colocada' ? styles.radioBotonSeleccionado : { opacity: 0.35 }
                ]}
              >
                <Text style={[
                  styles.radioTexto,
                  opcion === 'Colocada' && styles.radioTextoSeleccionado
                ]}>
                  {opcion}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Monto Recaudado ($)</Text>
          <TextInput
            style={[styles.input, styles.inputBloqueado]}
            placeholder="Se captura al recoger la alcancía"
            placeholderTextColor="#9AA8AC"
            editable={false}
          />
          <Text style={styles.ayuda}>
            Cuando la recojas, búscala en la Lista de Alcancías y cambia el estado a Devuelta o Faltante con su monto.
          </Text>
        </View>

        <TouchableOpacity 
          style={[styles.botonGuardar, guardando && { opacity: 0.7 }]} 
          onPress={manejarRegistro}
          disabled={guardando} 
        >
          <Text style={styles.textoBotonGuardar}>
            {guardando ? 'Guardando...' : 'Guardar Registro'}
          </Text>
          <Ionicons name="save-outline" size={20} color="#1E292D" style={{ marginLeft: 8 }} />
        </TouchableOpacity>

        {/* Espacio extra al final para que el teclado no tape el botón */}
        <View style={{ height: 40 }} />
      </ScrollView>
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
  formContainer: {
    padding: 24,
    flex: 1,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    color: '#C2DFE3',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    marginLeft: 4,
  },
  input: {
    backgroundColor: '#1E292D',
    color: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#3A4A50',
  },
  ayuda: {
    color: '#9AA8AC',
    fontSize: 12,
    marginTop: 6,
    marginLeft: 4,
  },
  avisoLote: {
    color: '#C06C6C',
    fontSize: 13,
    marginTop: 6,
    marginLeft: 4,
  },
  inputBloqueado: {
    backgroundColor: '#182024', // Más oscuro para indicar que no se puede tocar
    color: '#7A8C91', // Texto atenuado
    borderColor: '#182024',
  },
  radioContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 5,
  },
  radioBoton: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: '#1E292D',
    borderWidth: 1,
    borderColor: '#3A4A50',
    borderRadius: 10,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  radioBotonSeleccionado: {
    backgroundColor: '#C2DFE3',
    borderColor: '#C2DFE3',
  },
  radioTexto: {
    color: '#9AA8AC',
    fontWeight: 'bold',
    fontSize: 14,
  },
  radioTextoSeleccionado: {
    color: '#1E292D',
  },
  botonGuardar: {
    backgroundColor: '#C2DFE3',
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  textoBotonGuardar: {
    color: '#1E292D',
    fontSize: 16,
    fontWeight: 'bold',
  },
});