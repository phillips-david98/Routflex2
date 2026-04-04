import logging
from fastapi import FastAPI

app = FastAPI()

logging.basicConfig(level=logging.INFO, format="%(message)s")
logging.getLogger(__name__).info("Sistema Routflex iniciado")

@app.get("/")
def home():
    return {"mensagem": "Routflex API funcionando"}
