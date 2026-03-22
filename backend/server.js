const express = require("express")
const cors = require("cors")

const app = express()

app.use(cors())
app.use(express.json())

// rota inicial
app.get("/", (req, res) => {
    res.json({
        sistema: "Routflex",
        status: "API online"
    })
})

// lista de clientes
app.get("/clientes", (req, res) => {

    const clientes = [
        {
            id: 1,
            nome: "Cliente A",
            lat: -15.601,
            lng: -56.097
        },
        {
            id: 2,
            nome: "Cliente B",
            lat: -15.603,
            lng: -56.099
        },
        {
            id: 3,
            nome: "Cliente C",
            lat: -15.605,
            lng: -56.101
        }
    ]

    res.json(clientes)
})

const PORT = 3000

app.listen(PORT, () => {
    console.log("Servidor Routflex rodando na porta 3000")
})
