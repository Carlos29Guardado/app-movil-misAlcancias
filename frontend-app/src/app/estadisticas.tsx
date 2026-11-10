import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useEstadisticas } from '../hooks/useEstadisticas';

// $1,234.50
const formatoDinero = (n: number) => `$${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;

const porcentaje = (parte: number, total: number) => (total > 0 ? Math.round((parte / total) * 100) : 0);

const ESTADOS = [
  { clave: 'Colocada', etiqueta: 'Colocadas', color: '#C2DFE3' },
  { clave: 'Devuelta', etiqueta: 'Devueltas', color: '#8FBC8F' },
  { clave: 'Faltante', etiqueta: 'Faltantes', color: '#C06C6C' },
] as const;

export default function EstadisticasScreen() {
  const router = useRouter();

  const {
    esAdmin,
    estadisticas,
    sinConexion,
    cargando,
    refrescando,
    onRefresh,
    exportando,
    exportarExcel,
    nombreColaborador
  } = useEstadisticas();

  const { registradas, conteo, total, promedio, sinSubir, totalRango, porColaborador } = estadisticas;

  return (
    <View style={styles.container}>
      {/* Encabezado */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.botonRegresar}>
          <Ionicons name="arrow-back" size={28} color="#C2DFE3" />
        </TouchableOpacity>
        <Text style={styles.tituloHeader}>Estadísticas</Text>
        <View style={{ width: 28 }} />
      </View>

      {cargando ? (
        <View style={styles.centrado}>
          <ActivityIndicator size="large" color="#C2DFE3" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.contenido}
          refreshControl={
            <RefreshControl
              refreshing={refrescando}
              onRefresh={onRefresh}
              tintColor="#C2DFE3"
              colors={['#1E292D']}
              progressBackgroundColor="#C2DFE3"
            />
          }
        >
          {sinConexion && (
            <View style={styles.aviso}>
              <Ionicons name="cloud-offline-outline" size={18} color="#E0B15C" />
              <Text style={styles.textoAviso}>
                Sin conexión: se muestran los datos guardados en este teléfono y pueden faltar los de otros colaboradores.
              </Text>
            </View>
          )}

          {/* Total recaudado */}
          <View style={styles.tarjetaTotal}>
            <Text style={styles.etiquetaTotal}>Total recaudado</Text>
            <Text style={styles.montoTotal}>{formatoDinero(total)}</Text>
            <Text style={styles.detalleTotal}>
              Promedio por alcancía devuelta: {formatoDinero(promedio)}
            </Text>
          </View>

          {/* Avance del rango */}
          <View style={styles.tarjeta}>
            <View style={styles.filaTitulo}>
              <Text style={styles.tituloTarjeta}>Alcancías registradas</Text>
              <Text style={styles.valorDestacado}>
                {registradas}{totalRango != null ? ` de ${totalRango}` : ''}
              </Text>
            </View>
            {totalRango != null && (
              <>
                <View style={styles.barraFondo}>
                  <View style={[styles.barraRelleno, { width: `${Math.min(porcentaje(registradas, totalRango), 100)}%`, backgroundColor: '#C2DFE3' }]} />
                </View>
                <Text style={styles.ayuda}>{porcentaje(registradas, totalRango)}% del rango de la comunidad</Text>
              </>
            )}
            {sinSubir > 0 && (
              <Text style={styles.textoPendiente}>
                {sinSubir} {sinSubir === 1 ? 'alcancía sin subir' : 'alcancías sin subir'} desde este teléfono
              </Text>
            )}
          </View>

          {/* Por estado */}
          <View style={styles.tarjeta}>
            <Text style={styles.tituloTarjeta}>Por estado</Text>
            {ESTADOS.map(({ clave, etiqueta, color }) => (
              <View key={clave} style={styles.filaEstado}>
                <View style={styles.filaTitulo}>
                  <Text style={styles.textoEstado}>{etiqueta}</Text>
                  <Text style={styles.textoEstado}>
                    {conteo[clave]} <Text style={styles.ayuda}>({porcentaje(conteo[clave], registradas)}%)</Text>
                  </Text>
                </View>
                <View style={styles.barraFondo}>
                  <View style={[styles.barraRelleno, { width: `${porcentaje(conteo[clave], registradas)}%`, backgroundColor: color }]} />
                </View>
              </View>
            ))}
          </View>

          {/* Por colaborador (solo admin) */}
          {esAdmin && porColaborador.length > 0 && (
            <View style={styles.tarjeta}>
              <Text style={styles.tituloTarjeta}>Por colaborador</Text>
              {porColaborador.map((c) => (
                <View key={c.usuario_id} style={styles.filaColaborador}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.nombreColaborador}>{nombreColaborador(c.usuario_id)}</Text>
                    <Text style={styles.ayuda}>
                      {c.registradas} registradas · {c.devueltas} devueltas
                    </Text>
                  </View>
                  <Text style={styles.montoColaborador}>{formatoDinero(c.monto)}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Exportar (solo admin) */}
          {esAdmin && (
            <>
              <TouchableOpacity
                style={[styles.botonPrincipal, exportando && styles.botonDeshabilitado]}
                onPress={exportarExcel}
                disabled={exportando}
              >
                {exportando ? (
                  <ActivityIndicator color="#1E292D" />
                ) : (
                  <>
                    <Ionicons name="download-outline" size={22} color="#1E292D" />
                    <Text style={styles.textoBotonPrincipal}>Exportar a Excel</Text>
                  </>
                )}
              </TouchableOpacity>
              <Text style={styles.ayudaCentrada}>
                Se descarga con todas las alcancías de la comunidad y un resumen por colaborador. Necesita internet.
              </Text>
            </>
          )}
        </ScrollView>
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
  contenido: {
    padding: 20,
    paddingBottom: 40,
  },
  aviso: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(224, 177, 92, 0.12)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  textoAviso: {
    flex: 1,
    color: '#E0B15C',
    fontSize: 13,
  },
  tarjetaTotal: {
    backgroundColor: '#C2DFE3',
    borderRadius: 20,
    padding: 22,
    marginBottom: 16,
    alignItems: 'center',
  },
  etiquetaTotal: {
    color: '#253237',
    fontSize: 14,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  montoTotal: {
    color: '#1E292D',
    fontSize: 40,
    fontWeight: 'bold',
    marginVertical: 6,
  },
  detalleTotal: {
    color: '#3A4A50',
    fontSize: 13,
  },
  tarjeta: {
    backgroundColor: '#1E292D',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#3A4A50',
  },
  filaTitulo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tituloTarjeta: {
    color: '#C2DFE3',
    fontSize: 14,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
  },
  valorDestacado: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  barraFondo: {
    height: 10,
    borderRadius: 5,
    backgroundColor: '#3A4A50',
    overflow: 'hidden',
    marginTop: 6,
  },
  barraRelleno: {
    height: '100%',
    borderRadius: 5,
  },
  ayuda: {
    color: '#9AA8AC',
    fontSize: 13,
    marginTop: 4,
  },
  ayudaCentrada: {
    color: '#9AA8AC',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
  },
  textoPendiente: {
    color: '#E0B15C',
    fontSize: 13,
    marginTop: 8,
  },
  filaEstado: {
    marginBottom: 14,
  },
  textoEstado: {
    color: '#FFFFFF',
    fontSize: 15,
  },
  filaColaborador: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#2C3A40',
  },
  nombreColaborador: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  montoColaborador: {
    color: '#8FBC8F',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  botonPrincipal: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#C2DFE3',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botonDeshabilitado: {
    opacity: 0.6,
  },
  textoBotonPrincipal: {
    color: '#1E292D',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
