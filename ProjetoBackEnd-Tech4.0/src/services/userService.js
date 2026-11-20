const { User } = require("../models");
const AppError = require("./AppError");

const PUBLIC_ATTRIBUTES = ["id", "firstname", "surname", "email"];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const isFilled = (value) => typeof value === "string" && value.trim() !== "";

function toPublic(user) {
  const { id, firstname, surname, email } = user;
  return { id, firstname, surname, email };
}

// Id inválido (não numérico, zero, negativo) equivale a recurso inexistente.
function parseId(rawId) {
  const id = Number(rawId);
  if (!Number.isInteger(id) || id < 1) {
    throw new AppError(404, "Usuário não encontrado");
  }
  return id;
}

async function findOrFail(rawId) {
  const user = await User.findByPk(parseId(rawId));
  if (!user) {
    throw new AppError(404, "Usuário não encontrado");
  }
  return user;
}

function validateProfile({ firstname, surname, email } = {}) {
  if (!isFilled(firstname)) throw new AppError(400, "firstname é obrigatório");
  if (!isFilled(surname)) throw new AppError(400, "surname é obrigatório");
  if (!isFilled(email) || !EMAIL_REGEX.test(email)) {
    throw new AppError(400, "email inválido");
  }
}

async function assertEmailAvailable(email, ignoreId) {
  const existing = await User.findOne({ where: { email } });
  if (existing && existing.id !== ignoreId) {
    throw new AppError(400, "email já cadastrado");
  }
}

async function getById(rawId) {
  const user = await User.findByPk(parseId(rawId), {
    attributes: PUBLIC_ATTRIBUTES,
  });
  if (!user) {
    throw new AppError(404, "Usuário não encontrado");
  }
  return toPublic(user);
}

async function create(data = {}) {
  validateProfile(data);

  if (!isFilled(data.password)) {
    throw new AppError(400, "password é obrigatório");
  }
  if (data.password !== data.confirmPassword) {
    throw new AppError(400, "password e confirmPassword devem ser iguais");
  }

  await assertEmailAvailable(data.email);

  // O hash da senha é gerado pelo hook do model.
  const user = await User.create({
    firstname: data.firstname,
    surname: data.surname,
    email: data.email,
    password: data.password,
  });
  return toPublic(user);
}

async function update(rawId, data = {}) {
  const user = await findOrFail(rawId);
  validateProfile(data);
  await assertEmailAvailable(data.email, user.id);

  await user.update({
    firstname: data.firstname,
    surname: data.surname,
    email: data.email,
  });
}

async function remove(rawId) {
  const user = await findOrFail(rawId);
  await user.destroy();
}

module.exports = { getById, create, update, remove };
