import React from 'react';
import { View, Text, StyleSheet, SectionList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useUsuariosComunidad } from '../hooks/useUsuariosComunidad';

export default function UsuariosComunidadScreen() {
  const router = useRouter();

  const {
    administradores,
    colaboradores,
    cargando,
    refrescando,
    error,
    onRefresh,
    mostrarOpciones
  } = useUsuariosComunidad();

  // Secciones de la lista: primero el administrador y después los colaboradores
  const secciones = [
    { titulo: 'Administrador', data: administradores, vacio: 'La comunidad no tiene administrador.' },
    { titulo: `Colaboradores (${colaboradores.length}) · toca uno para ver opciones`, data: colaboradores, vacio: 'Aún no hay colaboradores en la comunidad.' },
  ];

  // El diseño de cada tarjeta de usuario
  const renderItem = ({ item }: { item: any }) => {
    const esAdmin = item.rol === 'admin';

    return (
      <TouchableOpacity
        style={styles.tarjeta}
        activeOpacity={esAdmin ? 1 : 0.7}
        disabled={esAdmin}
        // Tocar a un colaborador permite hacerlo administrador o sacarlo de la comunidad
        onPress={() => mostrarOpciones(item)}
      >
        <View style={[styles.avatar, esAdmin && styles.avatarAdmin]}>
          <Ionicons name={esAdmin ? 'shield-checkmark' : 'person'} size={22} color="#253237" />
        </View>
        <View style={styles.info}>
          <Text style={styles.nombreTexto}>{item.nombre || 'Sin nombre'}</Text>
          <Text style={styles.emailTexto}>{item.email}</Text>
        </View>
        <View style={[styles.badgeRol, { backgroundColor: esAdmin ? 'rgba(143, 188, 143, 0.2)' : 'rgba(194, 223, 227, 0.2)' }]}>
          <Text style={[styles.textoRol, { color: esAdmin ? '#8FBC8F' : '#C2DFE3' }]}>
            {esAdmin ? 'Admin' : 'Colaborador'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Encabezado */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.botonRegresar}>
          <Ionicons name="arrow-back" size={28} color="#C2DFE3" />
        </TouchableOpacity>
        <Text style={styles.tituloHeader}>Usuarios</Text>
        <View style={{ width: 28 }} />
      </View>

      {/* Cuerpo principal */}
      {cargando ? (
        <View style={styles.centrado}>
          <ActivityIndicator size="large" color="#C2DFE3" />
          <Text style={styles.textoSecundario}>Cargando usuarios...</Text>
        </View>
      ) : (
        <SectionList
          sections={error ? [] : secciones}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          renderSectionHeader={({ section }) => (
            <Text style={styles.tituloSeccion}>{section.titulo}</Text>
          )}
          renderSectionFooter={({ section }) =>
            section.data.length === 0 ? (
              <Text style={styles.textoVacioSeccion}>{section.vacio}</Text>
            ) : null
          }
          stickySectionHeadersEnabled={false}
          contentContainerStyle={styles.listaPadding}
          refreshControl={
            <RefreshControl
              refreshing={refrescando}
              onRefresh={onRefresh}
              tintColor="#C2DFE3"
              colors={['#1E292D']}
              progressBackgroundColor="#C2DFE3"
            />
          }
          ListEmptyComponent={
            error ? (
              <View style={styles.vacioContainer}>
                <Ionicons name="cloud-offline-outline" size={60} color="#3A4A50" />
                <Text style={styles.textoVacio}>{error}</Text>
              </View>
            ) : null
          }
        />
      )}
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
  },
  textoSecundario: {
    color: '#9AA8AC',
    marginTop: 10,
    fontSize: 16,
  },
  listaPadding: {
    padding: 20,
    paddingBottom: 40,
  },
  tituloSeccion: {
    color: '#9AA8AC',
    fontSize: 14,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 10,
    marginBottom: 12,
  },
  tarjeta: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E292D',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#3A4A50',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#C2DFE3',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  avatarAdmin: {
    backgroundColor: '#8FBC8F',
  },
  info: {
    flex: 1,
  },
  nombreTexto: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
  emailTexto: {
    color: '#9AA8AC',
    fontSize: 13,
    marginTop: 2,
  },
  badgeRol: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    marginLeft: 10,
  },
  textoRol: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  textoVacioSeccion: {
    color: '#9AA8AC',
    fontSize: 14,
    fontStyle: 'italic',
    marginBottom: 12,
  },
  vacioContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 100,
    paddingHorizontal: 20,
  },
  textoVacio: {
    color: '#9AA8AC',
    fontSize: 16,
    marginTop: 15,
    textAlign: 'center',
  },
});
