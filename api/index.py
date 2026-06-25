"""Vercel serverless entry point for AI Blog Agent."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.server import app
