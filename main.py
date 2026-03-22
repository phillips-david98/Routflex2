from fastapi import FastAPI

app = FastAPI()

print("Sistema Routflex iniciado")

@app.get("/")
def home():
    return {"mensagem": "Routflex API funcionando"}
