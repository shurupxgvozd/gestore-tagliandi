const express = require("express");
const path = require("path");
const mysql = require("mysql2/promise");
require('dotenv').config();


const app = express();
const port = process.env.PORT || 3000;


const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
});

module.exports = pool;



async function initDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS interventi (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nome VARCHAR(100) NOT NULL,
        cognome VARCHAR(100) NOT NULL,
        email VARCHAR(255),
        telefono VARCHAR(50) NOT NULL,
        targa VARCHAR(20) NOT NULL,
        modello VARCHAR(255) NOT NULL,
        anno INT NOT NULL,
        chilometraggio INT,
        intervento VARCHAR(100) NOT NULL,
        data_prevista DATE NOT NULL,
        note TEXT,
        privacy BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    console.log("Database pronto");
  } catch (error) {
    console.error("Errore di connessione al database:", error.message);
  }
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok", database: "connected" });
  } catch (error) {
    res.json({ status: "ok", database: "disconnected" });
  }
});

app.get("/api/interventi", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM interventi ORDER BY created_at DESC");
    res.json(rows);
  } catch (error) {
    console.error("Errore nel recupero interventi:", error.message);
    res.status(500).json({ message: "Errore nel recupero interventi", error: error.message });
  }
});

app.post(["/api/interventi", "/api/interventi/add"], async (req, res) => {
  const {
    nome,
    cognome,
    email,
    telefono,
    targa,
    modello,
    anno,
    chilometraggio,
    intervento,
    data,
    note,
    privacy,
  } = req.body;

  const privacyChecked = privacy === "on" || privacy === true || privacy === 1;

  if (!nome || !cognome || !telefono || !targa || !modello || !anno || !intervento || !data || !privacyChecked) {
    return res.status(400).json({
      message: "Dati obbligatori mancanti o privacy non confermata.",
    });
  }

  try {
    const [result] = await pool.execute(
      `INSERT INTO interventi
        (nome, cognome, email, telefono, targa, modello, anno, chilometraggio, intervento, data_prevista, note, privacy)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        nome.trim(),
        cognome.trim(),
        email ? email.trim() : null,
        telefono.trim(),
        targa.trim().toUpperCase(),
        modello.trim(),
        Number(anno),
        chilometraggio !== "" && chilometraggio != null ? Number(chilometraggio) : null,
        intervento,
        data,
        note ? note.trim() : null,
        true,
      ]
    );

    res.status(201).json({
      message: "Intervento salvato correttamente.",
      id: result.insertId,
    });
  } catch (error) {
    console.error("Errore durante il salvataggio dell'intervento:", error.message);
    res.status(500).json({
      message: "Errore durante il salvataggio dell'intervento.",
      error: error.message,
	  
    });
  }
});

initDatabase();

app.listen(port, () => {
  console.log(`Server avviato su http://localhost:${port}`);
});