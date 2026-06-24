"""Tests for FastAPI server."""
import pytest
from fastapi.testclient import TestClient
from src.server import app

client = TestClient(app)

def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"

def test_generate_endpoint_exists():
    response = client.post("/generate", json={"topic": "AI agents"})
    assert response.status_code in [200, 500]

def test_root_endpoint():
    response = client.get("/")
    assert response.status_code == 200
    assert "AI Blog Agent API" in response.json()["message"]
