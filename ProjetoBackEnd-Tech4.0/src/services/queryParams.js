const AppError = require("./AppError");

const DEFAULT_LIMIT = 12;
const DEFAULT_PAGE = 1;
const INTEGER_REGEX = /^-?\d+$/;

// limit: padrão 12; -1 busca todos os itens; demais valores devem ser > 0.
function parseLimit(value) {
  if (value === undefined) return DEFAULT_LIMIT;
  if (typeof value !== "string" || !INTEGER_REGEX.test(value)) {
    throw new AppError(400, "limit deve ser um número inteiro");
  }
  const limit = Number(value);
  if (limit !== -1 && limit < 1) {
    throw new AppError(400, "limit deve ser -1 ou maior que zero");
  }
  return limit;
}

// page: padrão 1; deve ser > 0 (ignorado quando limit = -1).
function parsePage(value) {
  if (value === undefined) return DEFAULT_PAGE;
  if (typeof value !== "string" || !INTEGER_REGEX.test(value)) {
    throw new AppError(400, "page deve ser um número inteiro");
  }
  const page = Number(value);
  if (page < 1) {
    throw new AppError(400, "page deve ser maior que zero");
  }
  return page;
}

module.exports = { parseLimit, parsePage };
