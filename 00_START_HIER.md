# 🎯 TENDERPLANNER v2.0 - INSTALLATIE MET 2 ZIP BESTANDEN

## 📦 JE HEBT 2 ZIP BESTANDEN:

1. **frontend-complete.zip** (37 KB) - Complete frontend applicatie
2. **backend-complete.zip** (15 KB) - Complete backend API

---

## 🚀 INSTALLATIE IN 3 SIMPELE STAPPEN

### STAP 1: Maak hoofdfolder

Maak een nieuwe folder: `tenderplanner`

---

### STAP 2: Unzip beide bestanden

1. Download **frontend-complete.zip**
2. Unzip in `tenderplanner/`
3. Hernoem `complete-frontend` → `frontend`

4. Download **backend-complete.zip**
5. Unzip in `tenderplanner/`
6. De `backend` folder blijft zoals hij is

**Eindresultaat:**
```
📁 tenderplanner/
  ├── 📁 frontend/
  │   ├── 📁 css/
  │   ├── 📁 js/
  │   ├── 📁 pages/
  │   ├── index.html
  │   └── README.md
  └── 📁 backend/
      ├── 📁 src/
      ├── .env.example
      ├── package.json
      └── README.md
```

---

### STAP 3: Configureer

#### A. Frontend configureren

1. Open `frontend/js/config.js`
2. Vul je Supabase credentials in:

```javascript
export const supabase = createClient(
    'https://your-project.supabase.co',  // ← Jouw URL
    'eyJhbGc...'                          // ← Jouw anon key
);
```

3. Open `frontend/pages/login.html`
4. Vul **dezelfde** credentials in (regel 88)

#### B. Backend configureren

1. Open `backend` folder
2. Kopieer `.env.example` → `.env`

**Windows:**
```
copy .env.example .env
```

**Mac/Linux:**
```bash
cp .env.example .env
```

3. Open `.env` in text editor
4. Vul in:

```env
NODE_ENV=development
PORT=3000
FRONTEND_URL=http://localhost:8000

SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...  # Service Role Key! (niet anon)
SUPABASE_ANON_KEY=eyJhbGc...           # Anon key

JWT_SECRET=maak-hier-een-lange-random-string-123456789
```

**WAAR VIND JE DEZE KEYS?**

Ga naar: Supabase Dashboard → Settings → API

- **Project URL** = SUPABASE_URL
- **anon public** = SUPABASE_ANON_KEY
- **service_role** = SUPABASE_SERVICE_ROLE_KEY (klik "Reveal"!)

---

## 🏃 STARTEN

### STAP 1: Backend starten

Open Terminal/CMD in de `backend` folder:

```bash
cd tenderplanner/backend

# Installeer dependencies (eerste keer)
npm install

# Start server
npm start
```

Je ziet:
```
🚀 TenderPlanner Backend Server
🚀 Port: 3000
```

**Laat dit terminal venster open!**

---

### STAP 2: Frontend starten

Open een **NIEUW** Terminal venster in de `frontend` folder:

```bash
cd tenderplanner/frontend

# Start server (Python)
python -m http.server 8000
```

Of:
```bash
# Node.js
npx http-server -p 8000
```

---

### STAP 3: Open browser

Ga naar: `http://localhost:8000`

---

## 🧪 TESTEN

### Test 1: Backend health check

Browser → `http://localhost:3000/health`

Moet JSON tonen met `"status": "ok"`

### Test 2: Login

1. Ga naar `http://localhost:8000/login.html`
2. Login met je Supabase credentials

**Nog geen user?**

Supabase Dashboard → Authentication → Users → Add user

### Test 3: TotaalView

Na login zie je:
- 📊 Totaaloverzicht header
- 🔍 Search bar en filters
- (Lege lijst als je nog geen tenders hebt)

---

## 📊 FOLDER STRUCTUUR OVERZICHT

```
tenderplanner/
│
├── frontend/                    ← Complete frontend
│   ├── css/
│   │   ├── main.css
│   │   ├── components.css
│   │   ├── tender-card.css
│   │   └── totaal-view.css
│   ├── js/
│   │   ├── auth/
│   │   │   └── AuthService.js
│   │   ├── components/
│   │   │   ├── Component.js
│   │   │   ├── TenderCard.js
│   │   │   ├── StatusBadge.js
│   │   │   ├── PhaseBadge.js
│   │   │   └── LoadingSpinner.js
│   │   ├── services/
│   │   │   ├── TenderService.js   # Supabase direct
│   │   │   └── ApiService.js      # Backend API
│   │   ├── views/
│   │   │   └── TotaalView.js
│   │   ├── config.js              ← CONFIG HIER!
│   │   ├── router.js
│   │   └── main.js
│   ├── pages/
│   │   └── login.html             ← CONFIG OOK HIER!
│   ├── index.html
│   └── README.md
│
└── backend/                     ← Complete backend
    ├── src/
    │   ├── config/
    │   │   ├── env.js
    │   │   └── database.js
    │   ├── middleware/
    │   │   ├── auth.js
    │   │   ├── errorHandler.js
    │   │   ├── rateLimit.js
    │   │   └── validation.js
    │   ├── routes/
    │   │   └── tenders.js
    │   ├── services/
    │   │   └── tenderService.js
    │   ├── utils/
    │   │   └── logger.js
    │   └── server.js
    ├── .env.example
    ├── .env                     ← MAAK DIT AAN!
    ├── .gitignore
    ├── package.json
    └── README.md
```

---

## ✅ CHECKLIST

Alles werkt als:

- [ ] Backend draait op http://localhost:3000
- [ ] Frontend draait op http://localhost:8000
- [ ] `/health` endpoint werkt
- [ ] Je kunt inloggen
- [ ] TotaalView laadt
- [ ] Geen errors in browser console (F12)
- [ ] Geen errors in backend terminal

---

## 🐛 TROUBLESHOOTING

### "Cannot find module" (backend)
```bash
cd backend
npm install
```

### "CORS error"
→ Check `FRONTEND_URL` in backend `.env`
→ Moet exact zijn: `http://localhost:8000`

### "Authentication failed"
→ Check Supabase credentials in:
  - `frontend/js/config.js`
  - `frontend/login.html`
  - `backend/.env`

### "Port already in use"
→ Andere applicatie gebruikt de port
→ Stop die applicatie of gebruik andere port

### "Supabase error"
→ Check of alle 3 keys correct zijn:
  - URL
  - Anon key
  - Service role key

---

## 📚 MEER INFO

Zie de README files in beide folders:
- `frontend/README.md` - Frontend docs
- `backend/README.md` - Backend docs

---

## 🎯 VOLGENDE STAPPEN

1. ✅ Beide servers draaien
2. ✅ Login werkt
3. ✅ TotaalView laadt
4. ⏳ Test tender aanmaken (via browser console)
5. ⏳ Voeg meer views toe
6. ⏳ Deploy naar productie (Render)

---

## 💡 TIPS

- **Backend terminal** = laat draaien tijdens development
- **Frontend terminal** = laat ook draaien
- **Browser console** (F12) = check voor JavaScript errors
- **Backend terminal** = check voor server errors
- **Postman/Insomnia** = test API endpoints

---

**JE HEBT NU EEN VOLLEDIGE MODERN WEBAPP ARCHITECTUUR! 🎉**

- ✅ Gescheiden frontend/backend
- ✅ Professional code structuur
- ✅ Security best practices
- ✅ Schaalbaar en uitbreidbaar
- ✅ Production-ready

**VEEL SUCCES! 🚀**
