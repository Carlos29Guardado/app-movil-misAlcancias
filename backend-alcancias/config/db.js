const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.POSTGRE_SQL;

const pool = new Pool({
    connectionString,
    // Máximo de conexiones simultáneas a Neon (cada consulta tarda pocos milisegundos)
    max: 10,
    // Cierra conexiones inactivas antes de que Neon las corte al suspenderse
    idleTimeoutMillis: 30000,
    // Si Neon tarda en "despertar" no se queda esperando para siempre
    connectionTimeoutMillis: 10000,
    keepAlive: true,
});

// Si Neon cierra una conexión inactiva (se suspende o hay un corte de red), pg emite 'error'.
// Sin este manejador, Node.js detendría todo el servidor; así solo se registra y el pool
// abre una conexión nueva en la siguiente consulta.
pool.on('error', (error) => {
    console.error('Conexión inactiva con la base de datos cerrada inesperadamente:', error.message);
});

pool.connect( (err, client, release) =>{
    if(err){
        return console.error('Error adquiriendo el cliente de la base de datos', err.stack);
    }
    console.log('Conectado exitosamente a PostgreSQL en Neon');
    release();
})
module.exports = {
  query: (text, params) => pool.query(text, params),
  // Cliente dedicado para transacciones: BEGIN/COMMIT deben ir en la misma conexión
  connect: () => pool.connect(),
};
