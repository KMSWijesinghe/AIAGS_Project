To Run The ML Services - Newly
cd ml_service
pip install -r requirements.txt
python -m uvicorn app:app --host 127.0.0.1 --port 8000
