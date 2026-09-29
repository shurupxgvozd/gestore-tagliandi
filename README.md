# Gestore tagliandi

## Prerequisiti

- Node.js e npm
- Docker e Docker Compose

## Avvio del progetto

1. Installare le dipendenze:

	```bash
	npm install
	```

2. Avviare il container MySQL in background:

	```bash
	docker compose up -d mysql
	```

3. Controllare che il container sia attivo:

	```bash
	docker compose ps
	```

	Il servizio `mysql` deve avere stato `Up`.

4. Verificare che MySQL accetti connessioni:

	```bash
	docker exec mysql-dev mysqladmin ping -uutente -ppassword
	```

	Il risultato atteso è `mysqld is alive`.

5. Avviare l’applicazione in un terminale:

	```bash
	node server.js
	```

	L’app sarà disponibile su <http://localhost:3000>.

## Test dell’app e del database

Con l’applicazione in esecuzione, verificare la connessione al database:

```bash
curl http://localhost:3000/api/health
```

Risultato atteso:

```json
{"status":"ok","database":"connected"}
```

Per controllare direttamente le tabelle del database:

```bash
docker exec -it mysql-dev mysql -uutente -ppassword -Dmiodb
```

Nella console MySQL eseguire:

```sql
SHOW TABLES;
DESCRIBE interventi;
SELECT COUNT(*) FROM interventi;
SELECT * FROM interventi;
```

La tabella `interventi` viene creata automaticamente all’avvio di `server.js`.

## Log e arresto

Per visualizzare i log di MySQL:

```bash
docker compose logs -f mysql
```

Per arrestare il database:

```bash
docker compose stop mysql
```

Per arrestare e rimuovere il container senza cancellare i dati:

```bash
docker compose down
```

Il volume `mysql_data` conserva i dati del database tra gli avvii.