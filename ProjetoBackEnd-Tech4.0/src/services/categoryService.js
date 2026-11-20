const { Category } = require("../models");
const AppError = require("./AppError");

const ALLOWED_FIELDS = ["id", "name", "slug", "use_in_menu"];
const DEFAULT_LIMIT = 12;
const DEFAULT_PAGE = 1;
const INTEGER_REGEX = /^-?\d+$/;

function toPlain(category) {
  const data = category.get({ plain: true });
  if ("use_in_menu" in data) {
    data.use_in_menu = Boolean(data.use_in_menu);
  }
  return data;
}

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

function parseFields(value) {
  if (value === undefined) return ALLOWED_FIELDS;
  if (typeof value !== "string") {
    throw new AppError(400, "fields inválido");
  }
  const fields = value.split(",").map((field) => field.trim());
  const invalid = fields.filter((field) => !ALLOWED_FIELDS.includes(field));
  if (fields.length === 0 || invalid.length > 0) {
    throw new AppError(
      400,
      `fields inválido. Campos permitidos: ${ALLOWED_FIELDS.join(", ")}`,
    );
  }
  return fields;
}

function parseUseInMenu(value) {
  if (value === undefined) return undefined;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new AppError(400, "use_in_menu deve ser true ou false");
}

async function search(query = {}) {
  const limit = parseLimit(query.limit);
  const page = parsePage(query.page);
  const attributes = parseFields(query.fields);
  const useInMenu = parseUseInMenu(query.use_in_menu);

  const where = {};
  if (useInMenu !== undefined) {
    where.use_in_menu = useInMenu;
  }

  const options = { where, attributes, order: [["id", "ASC"]] };
  // Com limit = -1 busca todos os itens e a paginação não tem efeito.
  if (limit !== -1) {
    options.limit = limit;
    options.offset = (page - 1) * limit;
  }

  const { rows, count } = await Category.findAndCountAll(options);

  return { data: rows.map(toPlain), total: count, limit, page };
}

const isFilled = (value) => typeof value === "string" && value.trim() !== "";

// Id inválido (não numérico, zero, negativo) equivale a recurso inexistente.
async function findOrFail(rawId) {
  const id = Number(rawId);
  const category =
    Number.isInteger(id) && id >= 1 ? await Category.findByPk(id) : null;

  if (!category) {
    throw new AppError(404, "Categoria não encontrada");
  }
  return category;
}

// name e slug são obrigatórios; use_in_menu é opcional, mas deve ser booleano.
function validatePayload({ name, slug, use_in_menu: useInMenu } = {}) {
  if (!isFilled(name)) throw new AppError(400, "name é obrigatório");
  if (!isFilled(slug)) throw new AppError(400, "slug é obrigatório");
  if (useInMenu !== undefined && typeof useInMenu !== "boolean") {
    throw new AppError(400, "use_in_menu deve ser true ou false");
  }
}

function toPublic(category) {
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    use_in_menu: Boolean(category.use_in_menu),
  };
}

async function getById(rawId) {
  const category = await findOrFail(rawId);
  return toPublic(category);
}

async function create(data = {}) {
  validatePayload(data);

  const category = await Category.create({
    name: data.name,
    slug: data.slug,
    use_in_menu: data.use_in_menu, // undefined => padrão do model (false)
  });
  return toPublic(category);
}

async function update(rawId, data = {}) {
  const category = await findOrFail(rawId);
  validatePayload(data);

  const changes = { name: data.name, slug: data.slug };
  // Se use_in_menu não for enviado, o valor atual é mantido.
  if (data.use_in_menu !== undefined) {
    changes.use_in_menu = data.use_in_menu;
  }
  await category.update(changes);
}

async function remove(rawId) {
  const category = await findOrFail(rawId);
  await category.destroy();
}

module.exports = { search, getById, create, update, remove };
