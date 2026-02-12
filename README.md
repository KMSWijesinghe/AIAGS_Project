# AIGS – AI Assignment Grading System (Node.js + MySQL + Python ML)

This project keeps your existing HTML/CSS UI and connects it to a **Node.js (Express) backend**, **MySQL database**, and a **Python ML service** that loads your `.pkl` model.

## 1) Folder structure

- `frontend/` – your original UI (HTML/CSS) with small JS additions to call the backend APIs
- `backend/` – Express API + MySQL
- `ml_service/` – FastAPI service that loads `model.pkl` and returns an AI grade + report

## 2) Prerequisites

- Node.js 18+
- MySQL 8+
- Python 3.10+

## 3) Setup steps

### A) MySQL schema

1. Create a database user (optional) and ensure MySQL is running.
2. In `backend/`, copy env file:

```bash
cd backend
cp .env.example .env
```

3. Edit `.env` to match your MySQL credentials.
4. Run migrations (creates DB + tables):

```bash
npm install
npm run migrate
```

### B) Start the ML service (Python)

Put your trained model here:

- `ml_service/model.pkl`  (or set `MODEL_PATH` env)

Then:

```bash
cd ml_service
python -m venv .venv
# Windows: .venv\Scripts\activate
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --host 127.0.0.1 --port 8000
```

Health check:

- `GET http://127.0.0.1:8000/health`

### C) Start the Node backend (serves frontend too)

```bash
cd backend
npm run dev
```

Open:

- `http://localhost:4000/account/login.html`

## 4) Default login

The schema seeds a default admin user (change it later):

- Email: `admin@aigs.local`
- Password: **admin123**

If you want a different password, delete this user row in the `users` table and create a new one via SQL or API.

## 5) Main APIs (used by the UI)

- `POST /api/auth/login`
- `GET /api/assignments`
- `POST /api/assignments`
- `POST /api/rubrics`
- `POST /api/portfolios/upload` (multipart form: `student_no`, `assignment_id`, `file`)
- `POST /api/grading/assignment/:assignmentId/ai` (run AI grading)
- `POST /api/grading/portfolio/:id/final` (teacher score)
- `POST /api/grading/assignment/:assignmentId/publish`

## 6) Notes about the `.pkl`

The ML service assumes your `model.pkl` is **a scikit-learn Pipeline or model** that can do:

- `model.predict([text])`

If your model expects different input (e.g., numeric features), update `ml_service/app.py` to build the same features before calling `predict()`.
