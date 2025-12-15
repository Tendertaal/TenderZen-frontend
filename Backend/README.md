# TenderPlanner Python Backend

FastAPI backend voor TenderPlanner applicatie.

## 🚀 Quick Start

### 1. Setup Virtual Environment

```bash
# Windows
python -m venv venv
venv\Scripts\activate

# Mac/Linux
python -m venv venv
source venv/bin/activate
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Configure Environment

```bash
# Copy example env file
cp .env.example .env

# Edit .env with your credentials
# Fill in:
# - SUPABASE_SERVICE_ROLE_KEY
# - SUPABASE_ANON_KEY
# - JWT_SECRET
```

### 4. Test Configuration

```bash
python test_config.py
```

### 5. Run Server

```bash
# Development (with auto-reload)
python -m app.main

# Or with uvicorn directly
uvicorn app.main:app --reload --port 3000
```

## 📚 API Documentation

Once the server is running:

- **Swagger UI**: http://localhost:3000/api/docs
- **ReDoc**: http://localhost:3000/api/redoc
- **Health Check**: http://localhost:3000/health

## 📁 Project Structure

```
backend-python/
├── app/
│   ├── __init__.py
│   ├── config.py           # Configuration & settings
│   ├── main.py             # FastAPI app entry point
│   │
│   ├── core/               # Core functionality
│   │   ├── database.py     # Supabase client
│   │   ├── security.py     # Authentication & JWT
│   │   └── dependencies.py # FastAPI dependencies
│   │
│   ├── models/             # Pydantic models
│   │   ├── tender.py       # Tender models
│   │   └── user.py         # User models
│   │
│   ├── services/           # Business logic
│   │   └── tender_service.py
│   │
│   ├── api/                # API endpoints
│   │   └── v1/
│   │       └── tenders.py  # Tender routes
│   │
│   └── middleware/         # Middleware
│       └── rate_limit.py   # Rate limiting
│
├── tests/                  # Tests (to be added)
├── .env                    # Environment variables (not in git)
├── .env.example            # Environment template
├── requirements.txt        # Python dependencies
└── README.md               # This file
```

## 🔧 Configuration

All configuration is in `.env`:

```env
# Environment
NODE_ENV=development
PORT=3000
FRONTEND_URL=http://localhost:8000

# Supabase (REQUIRED)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-key-here
SUPABASE_ANON_KEY=your-key-here

# JWT (REQUIRED)
JWT_SECRET=your-secret-here

# Optional Features
OPENAI_API_KEY=sk-...        # For AI features
SENDGRID_API_KEY=SG...       # For email features
```

## 🔐 Security

- JWT authentication
- Password hashing with bcrypt
- Rate limiting (100 requests per 15 minutes)
- CORS protection
- Row Level Security (RLS) via Supabase

## 🧪 Testing

```bash
# Test configuration
python test_config.py

# Test database connection
python -m app.core.database

# Run all tests (when added)
pytest
```

## 📝 API Endpoints

### Tenders

- `GET /api/v1/tenders/` - Get all tenders
- `GET /api/v1/tenders/{id}` - Get specific tender
- `POST /api/v1/tenders/` - Create tender
- `PUT /api/v1/tenders/{id}` - Update tender
- `DELETE /api/v1/tenders/{id}` - Delete tender

All endpoints require authentication (Bearer token).

## 🚀 Deployment

### Production Mode

```bash
# Set environment
export NODE_ENV=production

# Run with gunicorn
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker
```

### Docker (optional)

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
CMD ["python", "-m", "app.main"]
```

## 🛠️ Development

### Adding New Endpoints

1. Create model in `app/models/`
2. Create service in `app/services/`
3. Create router in `app/api/v1/`
4. Register router in `app/main.py`

### Code Style

- Follow PEP 8
- Use type hints
- Add docstrings to functions
- Keep functions small and focused

## 📞 Support

Issues? Check:
1. Is `.env` configured correctly?
2. Is Supabase running?
3. Are dependencies installed?
4. Check logs for errors

## 📄 License

Private project - TenderPlanner
