require("dotenv").config();
const app = require("./app");
const { sequelize } = require("./models");

const PORT = process.env.PORT || 3000;

async function start() {
  try {
    await sequelize.authenticate();
    // Cria a tabela "users" caso ainda não exista.
    await sequelize.sync();
    console.log("Banco de dados conectado e tabelas sincronizadas.");

    app.listen(PORT, () => {
      console.log(`Servidor rodando na porta ${PORT}`);
    });
  } catch (error) {
    console.error("Falha ao iniciar a aplicação:", error);
    process.exit(1);
  }
}

start();
