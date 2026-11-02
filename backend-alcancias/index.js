require('dotenv').config();
const pool = require('./config/db');

// Una promesa rechazada que nadie maneje no debe detener el servidor durante la recolección:
// se registra para revisarla después y el servidor sigue atendiendo.
process.on('unhandledRejection', (motivo) => {
  console.error('Promesa rechazada sin manejar:', motivo);
});

const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/alcancias', require('./routes/alcanciaRoutes'));
app.use('/api/comunidad', require('./routes/comunidadRoutes'));

// Primero se aplican las migraciones; si fallan se registra el error y el servidor arranca igual
const { ejecutarMigraciones } = require('./config/migraciones');

ejecutarMigraciones()
  .catch((error) => console.error('Error al aplicar migraciones:', error))
  .finally(() => {
    app.listen(PORT, () => {
      console.log(`Servidor corriendo en el puerto ${PORT}`);
    });
  });