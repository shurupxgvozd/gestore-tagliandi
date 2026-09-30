console.log("Il server si sta avviando...");

require('dotenv').config();

const express = require('express');
const path = require('path');
const mysql = require('mysql2/promise');

const app = express();
const PORT = process.env.PORT || 3000;

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'utente',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_NAME || 'miodb',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

const pool = mysql.createPool(dbConfig);

async function waitForDatabase(maxAttempts = 30, delayMs = 2000) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await pool.query('SELECT 1');
      return;
    } catch (error) {
      if (attempt === maxAttempts) {
        throw error;
      }

      console.warn(`Database non pronto (${attempt}/${maxAttempts}), retry in ${delayMs}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

async function initializeDatabase() {
  try {
    await waitForDatabase();

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
        priorita VARCHAR(20),
        servizi TEXT,
        telefono VARCHAR(30),
        note TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB
    `);

    const [columns] = await pool.query('SHOW COLUMNS FROM tagliandi');
    const existingColumns = new Set(columns.map((column) => column.Field));
    const additionalColumns = {
      priorita: 'VARCHAR(20)',
      servizi: 'TEXT',
      telefono: 'VARCHAR(30)',
      note: 'TEXT',
    };

    for (const [column, definition] of Object.entries(additionalColumns)) {
      if (!existingColumns.has(column)) {
        await pool.query(`ALTER TABLE tagliandi ADD COLUMN ${column} ${definition}`);
      }
    }

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

app.get('/api/tagliandi', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        id, cliente, veicolo, targa, km, data_ingresso AS data,
        tipo_intervento AS intervento, priorita, stato, descrizione,
        servizi, costo, telefono, note
      FROM tagliandi
      ORDER BY created_at DESC, id DESC
    `);
    res.json(rows);
  } catch (error) {
    console.error('Errore durante il caricamento dei tagliandi:', error);
    res.status(500).json({ success: false, message: 'Impossibile caricare i tagliandi' });
  }
});

app.post('/api/tagliandi', async (req, res) => {
  const {
    cliente, veicolo, targa, km, data, intervento, priorita, stato,
    descrizione, servizi, costo, telefono, note,
  } = req.body;

  if (!cliente?.trim() || !veicolo?.trim() || !targa?.trim() || !intervento?.trim() || !descrizione?.trim()) {
    return res.status(400).json({ success: false, message: 'Completa tutti i campi obbligatori' });
  }

  const parsedKm = km === '' || km == null ? null : Number(km);
  const parsedCost = costo === '' || costo == null ? null : Number(costo);
  if ((parsedKm !== null && (!Number.isInteger(parsedKm) || parsedKm < 0)) ||
      (parsedCost !== null && (!Number.isFinite(parsedCost) || parsedCost < 0))) {
    return res.status(400).json({ success: false, message: 'Km e costo devono essere valori validi e non negativi' });
  }

  try {
    const [result] = await pool.execute(
      `INSERT INTO tagliandi
        (cliente, veicolo, targa, km, data_ingresso, tipo_intervento, priorita, stato,
         descrizione, servizi, costo, telefono, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        cliente.trim(), veicolo.trim(), targa.trim(), parsedKm, data || null,
        intervento.trim(), priorita || 'Media', stato || 'In lavorazione',
        descrizione.trim(), servizi || null, parsedCost, telefono?.trim() || null,
        note?.trim() || null,
      ],
    );
    res.status(201).json({ success: true, id: result.insertId });
  } catch (error) {
    console.error('Errore durante il salvataggio del tagliando:', error);
    res.status(500).json({ success: false, message: 'Impossibile salvare il tagliando' });
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
