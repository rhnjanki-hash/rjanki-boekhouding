# R. Janki Contracting Group – Boekhouding

Web-app voor bonnen, openstaande rekeningen, leningen en maandrapportages (Excel/PDF).
Met inloggen en drie rollen: **beheerder**, **gebruiker**, **viewer**.

## Stack
- Frontend: één HTML-bestand (`public/index.html`)
- Backend: Node.js + Express (`server.js`)
- Database: PostgreSQL op **Neon**
- Hosting: **Render** (web service)

---

## Stap 1 – Neon (database)
1. Ga naar https://console.neon.tech en maak een project aan (bijv. `rjanki-boekhouding`).
2. Klik op **Connect** → kies **Node.js** → kopieer de connection string.
   Die ziet er zo uit: `postgresql://user:pass@ep-xxxx.neon.tech/neondb?sslmode=require`
3. Bewaar die – dit is je `DATABASE_URL`. De tabellen worden automatisch aangemaakt bij de eerste start.

## Stap 2 – GitHub
1. Maak een nieuwe repository aan (bijv. `rjanki-boekhouding`), **private**.
2. Upload alle bestanden uit deze map (of via git):
   ```bash
   git init
   git add .
   git commit -m "Boekhouding v1"
   git branch -M main
   git remote add origin https://github.com/JOUWNAAM/rjanki-boekhouding.git
   git push -u origin main
   ```
   `.env` en `node_modules` worden niet meegestuurd (staan in `.gitignore`).

## Stap 3 – Render (hosting)
1. Ga naar https://dashboard.render.com → **New** → **Web Service**.
2. Koppel je GitHub-repository.
3. Instellingen:
   - Runtime: **Node**
   - Build command: `npm install`
   - Start command: `npm start`
   - Plan: Free is genoeg om te starten
4. Bij **Environment variables** toevoegen:
   | Naam | Waarde |
   |---|---|
   | `DATABASE_URL` | de connection string van Neon |
   | `JWT_SECRET` | een lange willekeurige tekst (Render kan die genereren) |
   | `ADMIN_USER` | `admin` (of eigen naam) |
   | `ADMIN_PASSWORD` | het wachtwoord van de eerste beheerder |
5. Klik **Create Web Service**. Na 1–2 minuten staat de app live op `https://rjanki-boekhouding.onrender.com`.

> Er staat ook een `render.yaml` in de map: via **New → Blueprint** in Render worden de instellingen automatisch ingelezen.

## Stap 4 – Eerste keer inloggen
- Log in met `ADMIN_USER` / `ADMIN_PASSWORD`.
- Ga naar **Gebruikers** en maak accounts aan voor de anderen.
- Wijzig daarna je eigen wachtwoord via de zijbalk (**Wachtwoord wijzigen**).

## Rollen
| Rol | Mag |
|---|---|
| **Viewer** | alles bekijken, printen, Excel/PDF downloaden |
| **Gebruiker** | + bonnen, rekeningen, leningen toevoegen/wijzigen, op betaald zetten |
| **Beheerder** | + gebruikers aanmaken, rollen wijzigen, wachtwoorden resetten |

## Updates doorvoeren
Elke `git push` naar `main` → Render bouwt en zet de nieuwe versie automatisch live.
Je gegevens blijven in Neon staan.

## Lokaal draaien (optioneel)
```bash
cp .env.example .env     # vul DATABASE_URL etc. in
npm install
npm start                # http://localhost:3000
```

## Let op
- Free-plan van Render "slaapt" na 15 min zonder gebruik; de eerste keer openen duurt dan ~30 sec.
- Foto's van bonnen worden verkleind (max. 1000px) opgeslagen in de database.
- Maak in Neon af en toe een backup (Neon bewaart zelf 7 dagen history op het gratis plan).
