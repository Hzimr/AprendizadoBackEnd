const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const { User } = require("../models");
const AppError = require("./AppError");

const INVALID_CREDENTIALS = "email ou password incorretos";

// Usado quando o email não existe, para que o tempo de resposta seja parecido
// com o de uma senha errada (evita descobrir quais emails estão cadastrados).
const DUMMY_HASH = bcrypt.hashSync("senha-inexistente", 10);

async function generateToken({ email, password } = {}) {
  if (typeof email !== "string" || email.trim() === "") {
    throw new AppError(400, "email é obrigatório");
  }
  if (typeof password !== "string" || password === "") {
    throw new AppError(400, "password é obrigatório");
  }

  const user = await User.findOne({ where: { email } });
  const passwordMatches = await bcrypt.compare(
    password,
    user ? user.password : DUMMY_HASH,
  );

  // A mesma mensagem para email inexistente e senha errada.
  if (!user || !passwordMatches) {
    throw new AppError(400, INVALID_CREDENTIALS);
  }

  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET não está configurado no .env");
  }

  const token = jwt.sign(
    { id: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "1h" },
  );

  return { token };
}

module.exports = { generateToken };
