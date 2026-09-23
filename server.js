console.log("Il server si sta avviando...");

const express = require('express');
const path = require('path');
const mysql = require('mysql2/promise');

const app = express();
const PORT = process.env.PORT || 3000;

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root',
  database: process.env.DB_NAME || 'gestore_tagliandi',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

const pool = mysql.createPool(dbConfig);

async function initializeDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tagliandi (
        id INT AUTO_INCREMENT PRIMARY KEY,
        veicolo VARCHAR(100) NOT NULL,
        targa VARCHAR(20) NOT NULL,
        cliente VARCHAR(100) NOT NULL,
        tipo_intervento VARCHAR(100) NOT NULL,
        descrizione TEXT,
        stato VARCHAR(50) DEFAULT 'in_attesa',
        km INT,
        data_ingresso DATE,
        costo DECIMAL(10,2) DEFAULT 0.00,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB
    `);

    console.log('Tabella "tagliandi" verificata / creata con successo.');
  } catch (error) {
    console.error('Errore durante la creazione della tabella:', error);
    throw error;
  }
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/api/hello', (req, res) => {
  res.json({ message: 'Ciao dal server Express' });
});

app.get('/api/db-status', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT 1 AS ok');
    res.json({
      success: true,
      message: 'Connessione al database attiva',
      result: rows[0],
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Errore di connessione al database',
      error: error.message,
    });
  }
});

async function startServer() {
  try {
    await initializeDatabase();

    app.listen(PORT, () => {
      console.log(`Server avviato su http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Impossibile avviare il server:', error);
    process.exit(1);
  }
}

startServer();
