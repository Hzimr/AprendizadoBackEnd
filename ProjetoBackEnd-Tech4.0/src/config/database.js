require("dotenv").config();
const { Sequelize } = require("sequelize");

// Nos testes usamos SQLite em memória, para não depender de um MySQL rodando.
const sequelize =
  process.env.NODE_ENV === "test"
    ? new Sequelize({ dialect: "sqlite", storage: ":memory:", logging: false })
    : new Sequelize(
        process.env.DB_NAME,
        process.env.DB_USER,
        process.env.DB_PASSWORD,
        {
          host: process.env.DB_HOST,
          port: process.env.DB_PORT || 3306,
          dialect: "mysql",
          logging: false,
        },
      );

module.exports = sequelize;
