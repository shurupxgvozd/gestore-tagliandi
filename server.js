console.log("Il server si sta avviando...");

require('dotenv').config();

const express = require('express');
const path = require('path');
const mysql = require('mysql2/promise');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

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

    await pool.query(`
      CREATE TABLE IF NOT EXISTS clienti (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nome VARCHAR(100) NOT NULL,
        telefono VARCHAR(30) NOT NULL DEFAULT '',
        email VARCHAR(254) NOT NULL DEFAULT '',
        indirizzo VARCHAR(255) NOT NULL DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_cliente (nome, telefono)
      ) ENGINE=InnoDB
    `);

    const [clientColumns] = await pool.query('SHOW COLUMNS FROM clienti');
    const existingClientColumns = new Set(clientColumns.map((column) => column.Field));
    const additionalClientColumns = {
      email: "VARCHAR(254) NOT NULL DEFAULT ''",
      indirizzo: "VARCHAR(255) NOT NULL DEFAULT ''",
    };

    for (const [column, definition] of Object.entries(additionalClientColumns)) {
      if (!existingClientColumns.has(column)) {
        await pool.query(`ALTER TABLE clienti ADD COLUMN ${column} ${definition}`);
      }
    }

    await pool.query(`
      INSERT INTO clienti (nome, telefono)
      SELECT DISTINCT TRIM(cliente), COALESCE(TRIM(telefono), '')
      FROM tagliandi
      WHERE TRIM(cliente) <> ''
      ON DUPLICATE KEY UPDATE id = clienti.id
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS appointments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        cliente VARCHAR(100) NOT NULL,
        telefono VARCHAR(30),
        email VARCHAR(254),
        indirizzo VARCHAR(255) DEFAULT '',
        targa VARCHAR(20),
        veicolo VARCHAR(100),
        data DATE NOT NULL,
        ora TIME NOT NULL,
        intervento VARCHAR(100),
        descrizione TEXT,
        stato VARCHAR(50) DEFAULT 'in_attesa',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB
    `);

    // ensure indirizzo column exists for older schemas
    try {
      const [apptCols] = await pool.query('SHOW COLUMNS FROM appointments');
      const apCols = new Set(apptCols.map(c => c.Field));
      if (!apCols.has('indirizzo')) {
        await pool.query('ALTER TABLE appointments ADD COLUMN indirizzo VARCHAR(255) DEFAULT ""');
      }
    } catch (e) {
      // ignore - appointments may be created above just now
    }

    console.log('Tabella "tagliandi" e "appointments" verificate / create con successo.');
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

app.get('/api/clienti', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT id, nome, telefono, email, indirizzo
      FROM clienti
      ORDER BY nome ASC, telefono ASC
    `);
    res.json(rows);
  } catch (error) {
    console.error('Errore durante il caricamento dei clienti:', error);
    res.status(500).json({ success: false, message: 'Impossibile caricare la rubrica' });
  }
});

app.post('/api/tagliandi', async (req, res) => {
  const {
    cliente, veicolo, targa, km, data, intervento, priorita, stato,
    descrizione, servizi, costo, telefono, email, indirizzo, note,
  } = req.body;

  if (!cliente?.trim() || !veicolo?.trim() || !targa?.trim() || !intervento?.trim() || !descrizione?.trim()) {
    return res.status(400).json({ success: false, message: 'Completa tutti i campi obbligatori' });
  }
  if (!telefono?.trim() || !email?.trim() || !indirizzo?.trim()) {
    return res.status(400).json({ success: false, message: 'Inserisci telefono, email e indirizzo del cliente' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return res.status(400).json({ success: false, message: 'Inserisci un indirizzo email valido' });
  }

  const parsedKm = km === '' || km == null ? null : Number(km);
  const parsedCost = costo === '' || costo == null ? null : Number(costo);
  if ((parsedKm !== null && (!Number.isInteger(parsedKm) || parsedKm < 0)) ||
      (parsedCost !== null && (!Number.isFinite(parsedCost) || parsedCost < 0))) {
    return res.status(400).json({ success: false, message: 'Km e costo devono essere valori validi e non negativi' });
  }

  try {
    await pool.execute(
      `INSERT INTO clienti (nome, telefono, email, indirizzo)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE email = ?, indirizzo = ?`,
      [
        cliente.trim(), telefono.trim(), email.trim(), indirizzo.trim(),
        email.trim(), indirizzo.trim(),
      ],
    );

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

app.delete('/api/tagliandi/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) {
    return res.status(400).json({ success: false, message: 'ID intervento non valido' });
  }

  try {
    const [result] = await pool.execute('DELETE FROM tagliandi WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Intervento non trovato' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Errore durante l’eliminazione del tagliando:', error);
    res.status(500).json({ success: false, message: 'Impossibile eliminare il tagliando' });
  }
});
app.get('/api/appointments', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT id, cliente, telefono, email, indirizzo, targa, veicolo, data, ora, intervento, descrizione, stato
      FROM appointments
      ORDER BY data ASC, ora ASC
    `);
    res.json(rows);
  } catch (error) {
    console.error('Errore durante il caricamento degli appuntamenti:', error);
    res.status(500).json({ success: false, message: 'Impossibile caricare gli appuntamenti' });
  }
});

app.post('/api/appointments', async (req, res) => {
  const { cliente, telefono, email, indirizzo, targa, veicolo, data, ora, intervento, descrizione } = req.body;

  if (!cliente?.trim() || !telefono?.trim() || !email?.trim() || !targa?.trim() || !data || !ora || !intervento?.trim() || !indirizzo?.trim()) {
    return res.status(400).json({ success: false, message: 'Completa tutti i campi obbligatori (incluso indirizzo)' });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return res.status(400).json({ success: false, message: 'Inserisci un indirizzo email valido' });
  }

  // semplice validazione telefono: numeri, spazi, +, -, parentesi, almeno 7 caratteri
  if (!/^[0-9+()\-\s]{7,}$/.test(telefono.trim())) {
    return res.status(400).json({ success: false, message: 'Inserisci un numero di telefono valido' });
  }

  try {
    // controllo duplicati: stesso email + data + ora
    const [dup] = await pool.execute(
      `SELECT id FROM appointments WHERE email = ? AND data = ? AND ora = ? LIMIT 1`,
      [email.trim(), data, ora]
    );
    if (dup.length) {
      return res.status(409).json({ success: false, message: 'Appuntamento duplicato per questa email/data/ora' });
    }

    const [result] = await pool.execute(
      `INSERT INTO appointments (cliente, telefono, email, indirizzo, targa, veicolo, data, ora, intervento, descrizione, stato)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'in_attesa')`,
      [
        cliente.trim(), telefono.trim(), email.trim(), indirizzo.trim(), targa.trim(), veicolo?.trim() || null,
        data, ora, intervento.trim(), descrizione?.trim() || null
      ]
    );
    res.status(201).json({ success: true, id: result.insertId });
  } catch (error) {
    console.error('Errore durante il salvataggio dell\'appuntamento:', error);
    res.status(500).json({ success: false, message: 'Impossibile salvare l\'appuntamento' });
  }
});

app.delete('/api/appointments/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) {
    return res.status(400).json({ success: false, message: 'ID appuntamento non valido' });
  }

  try {
    const [result] = await pool.execute('DELETE FROM appointments WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Appuntamento non trovato' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Errore durante l\'eliminazione dell\'appuntamento:', error);
    res.status(500).json({ success: false, message: 'Impossibile eliminare l\'appuntamento' });
  }
});

app.put('/api/appointments/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) {
    return res.status(400).json({ success: false, message: 'ID appuntamento non valido' });
  }

  const { cliente, telefono, email, indirizzo, targa, veicolo, data, ora, intervento, descrizione, stato } = req.body;

  if (!cliente?.trim() || !telefono?.trim() || !email?.trim() || !targa?.trim() || !data || !ora || !intervento?.trim() || !indirizzo?.trim()) {
    return res.status(400).json({ success: false, message: 'Completa tutti i campi obbligatori (incluso indirizzo)' });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return res.status(400).json({ success: false, message: 'Inserisci un indirizzo email valido' });
  }

  if (!/^[0-9+()\-\s]{7,}$/.test(telefono.trim())) {
    return res.status(400).json({ success: false, message: 'Inserisci un numero di telefono valido' });
  }

  try {
    // controllo duplicati: stesso email + data + ora, escludendo l'id corrente
    const [dup] = await pool.execute(
      `SELECT id FROM appointments WHERE email = ? AND data = ? AND ora = ? AND id != ? LIMIT 1`,
      [email.trim(), data, ora, id]
    );
    if (dup.length) {
      return res.status(409).json({ success: false, message: 'Appuntamento duplicato per questa email/data/ora' });
    }

    const [result] = await pool.execute(
      `UPDATE appointments SET cliente = ?, telefono = ?, email = ?, indirizzo = ?, targa = ?, veicolo = ?, data = ?, ora = ?, intervento = ?, descrizione = ?, stato = ? WHERE id = ?`,
      [
        cliente.trim(), telefono.trim(), email.trim(), indirizzo.trim(), targa.trim(), veicolo?.trim() || null,
        data, ora, intervento.trim(), descrizione?.trim() || null, stato || 'in_attesa', id
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Appuntamento non trovato' });
    }

    res.json({ success: true, id });
  } catch (error) {
    console.error('Errore durante la modifica dell\'appuntamento:', error);
    res.status(500).json({ success: false, message: 'Impossibile modificare l\'appuntamento' });
  }
});

app.put('/api/tagliandi/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) {
    return res.status(400).json({ success: false, message: 'ID intervento non valido' });
  }

  const {
    cliente, veicolo, targa, km, data, intervento, priorita, stato,
    descrizione, servizi, costo, telefono, email, indirizzo, note,
  } = req.body;

  if (!cliente?.trim() || !veicolo?.trim() || !targa?.trim() || !intervento?.trim() || !descrizione?.trim()) {
    return res.status(400).json({ success: false, message: 'Completa tutti i campi obbligatori' });
  }
  if (!telefono?.trim() || !email?.trim() || !indirizzo?.trim()) {
    return res.status(400).json({ success: false, message: 'Inserisci telefono, email e indirizzo del cliente' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return res.status(400).json({ success: false, message: 'Inserisci un indirizzo email valido' });
  }

  const parsedKm = km === '' || km == null ? null : Number(km);
  const parsedCost = costo === '' || costo == null ? null : Number(costo);
  if ((parsedKm !== null && (!Number.isInteger(parsedKm) || parsedKm < 0)) ||
      (parsedCost !== null && (!Number.isFinite(parsedCost) || parsedCost < 0))) {
    return res.status(400).json({ success: false, message: 'Km e costo devono essere valori validi e non negativi' });
  }

  try {
    const [result] = await pool.execute(
      `UPDATE tagliandi 
       SET cliente = ?, veicolo = ?, targa = ?, km = ?, data_ingresso = ?, tipo_intervento = ?, 
           priorita = ?, stato = ?, descrizione = ?, servizi = ?, costo = ?, telefono = ?, note = ?, indirizzo = ?
       WHERE id = ?`,
      [
        cliente.trim(), veicolo.trim(), targa.trim(), parsedKm, data || null,
        intervento.trim(), priorita || 'Media', stato || 'In lavorazione',
        descrizione.trim(), servizi || null, parsedCost, telefono?.trim() || null,
        note?.trim() || null, indirizzo?.trim() || null, id,
      ],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Tagliando non trovato' });
    }

    res.json({ success: true, id });
  } catch (error) {
    console.error('Errore durante la modifica del tagliando:', error);
    res.status(500).json({ success: false, message: 'Impossibile modificare il tagliando' });
  }
});

async function startServer() {
  try {
    await initializeDatabase();

    app.listen(PORT, HOST, () => {
      console.log(`Server in ascolto su ${HOST}:${PORT}`);
    });
  } catch (error) {
    console.error('Impossibile avviare il server:', error);
    process.exit(1);
  }
}

startServer();
