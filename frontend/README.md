# TenderPlanner Frontend v2.0

## 📦 Wat zit erin?

Complete frontend applicatie met:
- ✅ Modern component-based architectuur
- ✅ Supabase integratie
- ✅ Backend API integratie
- ✅ Routing systeem
- ✅ Authentication
- ✅ TenderCard components
- ✅ TotaalView (overzicht)

## 📁 Structuur

```
frontend/
├── css/
│   ├── main.css              # Basis styling
│   ├── components.css        # Component styling
│   ├── tender-card.css       # TenderCard styling
│   └── totaal-view.css       # View styling
├── js/
│   ├── auth/
│   │   └── AuthService.js    # Authenticatie
│   ├── components/
│   │   ├── Component.js      # Base class
│   │   ├── TenderCard.js     # Tender kaart
│   │   ├── StatusBadge.js    # Status badge
│   │   ├── PhaseBadge.js     # Fase badge
│   │   └── LoadingSpinner.js # Loading animatie
│   ├── services/
│   │   ├── TenderService.js  # Supabase CRUD
│   │   └── ApiService.js     # Backend API calls
│   ├── views/
│   │   └── TotaalView.js     # Totaaloverzicht
│   ├── config.js             # Configuratie
│   ├── router.js             # Routing
│   └── main.js               # Entry point
├── pages/
│   └── login.html            # Login pagina
└── index.html                # Hoofdpagina
```

## ⚙️ Configuratie

### 1. Supabase Credentials

Open `js/config.js` en vul in:

```javascript
export const supabase = createClient(
    'YOUR_SUPABASE_URL',      // ← Jouw Supabase URL
    'YOUR_SUPABASE_ANON_KEY'  // ← Jouw Supabase anon key
);
```

### 2. Login Page

Open `/login.html` en vul dezelfde credentials in:

```javascript
const supabase = createClient(
    'YOUR_SUPABASE_URL',
    'YOUR_SUPABASE_ANON_KEY'
);
```

### 3. Backend URL (optioneel)

Als je backend hebt draaien, update in `js/config.js`:

```javascript
// Development
return 'http://localhost:3000';

// Production
return 'https://your-backend.onrender.com';
```

## 🚀 Starten

### Development

1. Start een local server:


```bash
# Optie 1: Python
python -m http.server 3000

# Optie 2: Node.js
npx http-server -p 3000

# Optie 3: VS Code Live Server
```

2. Open browser: `http://localhost:3000`

### Met Backend

1. Start backend eerst (zie backend README)
2. Start frontend server
3. Open `http://localhost:3000`

## 🔐 Eerste Login

1. Ga naar Supabase Dashboard → Authentication
2. Maak een test user aan
3. Login op `http://localhost:3000/login.html`

## 📡 API Integratie

De frontend kan op 2 manieren werken:

### Modus 1: Direct naar Supabase (standaard)
```javascript
// config.js
features: {
    useBackend: false  // Direct naar Supabase
}
```

### Modus 2: Via Backend API
```javascript
// config.js
features: {
    useBackend: true  // Via backend
}
```

## 🎨 Styling

CSS is modulair opgebouwd:
- `main.css` - Basis styling, variabelen, utilities
- `components.css` - Badge en spinner styling
- `tender-card.css` - TenderCard specifieke styling
- `totaal-view.css` - View layouts en filters

## 🧩 Components Gebruiken

```javascript
// Voorbeeld: TenderCard
import { TenderCard } from './components/TenderCard.js';

const tender = {
    naam: 'Gemeente Amsterdam',
    tender_nummer: 'GA-2025-001',
    status: 'go',
    fase: 'acquisitie'
    // ... meer velden
};

const card = new TenderCard(tender);
document.body.appendChild(card.render());

// Event listener
card.on('status-changed', (data) => {
    console.log('Status changed:', data);
});
```

## 🚀 Deployment

### Render (Static Site)

1. Push naar GitHub
2. New Static Site op Render
3. Settings:
   - Build Command: (leeg)
   - Publish Directory: `.`
4. Deploy!

### Netlify

1. Drag & drop hele frontend folder
2. Of: Connect GitHub repo
3. Deploy!

## 🐛 Troubleshooting

### "Module not found"
→ Check of alle files in de juiste folders staan
→ Check import paths (case-sensitive!)

### "Supabase error"
→ Check credentials in config.js EN login.html
→ Check RLS policies in Supabase

### "CORS error"
→ Gebruik een local server (niet file://)
→ Check backend CORS settings als je backend gebruikt

## 📚 Meer Info

- Supabase Docs: https://supabase.com/docs
- JavaScript Modules: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules

## 🎯 Volgende Stappen

1. ✅ Configureer Supabase credentials
2. ✅ Maak test user in Supabase
3. ✅ Start local server
4. ✅ Test login
5. ⏳ Voeg meer views toe (Acquisitie, Inschrijvingen, etc.)
6. ⏳ Deploy naar productie
