const AppError = require("./AppError");
const media = require("./mediaService");

const MAX_LENGTH = 255; // tamanho das colunas STRING
const SHAPES = ["square", "circle"];
const OPTION_TYPES = ["text", "color"];

const bad = (message) => new AppError(400, message);
const isPlainObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

// ---------- Campos simples ----------

function requireText(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw bad(`${label} é obrigatório`);
  }
  if (value.length > MAX_LENGTH) {
    throw bad(`${label} deve ter no máximo ${MAX_LENGTH} caracteres`);
  }
  return value;
}

function requireMoney(value, label) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw bad(
      `${label} é obrigatório e deve ser um número maior ou igual a zero`,
    );
  }
  return value;
}

function optionalBoolean(value, label) {
  if (value === undefined) return undefined;
  if (typeof value !== "boolean") {
    throw bad(`${label} deve ser true ou false`);
  }
  return value;
}

function optionalStock(value) {
  if (value === undefined) return undefined;
  if (!Number.isInteger(value) || value < 0) {
    throw bad("stock deve ser um número inteiro maior ou igual a zero");
  }
  return value;
}

function optionalDescription(value) {
  if (value === undefined || value === null) return value;
  if (typeof value !== "string" || value.length > MAX_LENGTH) {
    throw bad(`description deve ser um texto de até ${MAX_LENGTH} caracteres`);
  }
  return value;
}

function parsePositiveInt(value, label) {
  if (!Number.isInteger(value) || value < 1) {
    throw bad(`${label} deve ser um número inteiro maior que zero`);
  }
  return value;
}

function optionalCategoryIds(value) {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    throw bad("category_ids deve ser uma lista de ids");
  }
  const ids = value.map((id, index) =>
    parsePositiveInt(id, `category_ids[${index}]`),
  );
  return [...new Set(ids)];
}

// ---------- Imagens ----------

function requireImageType(type, label) {
  const extension = media.extensionForType(type);
  if (!extension) {
    throw bad(
      `${label}.type inválido. Use image/png, image/jpg, image/jpeg, image/gif ou image/webp`,
    );
  }
  return extension;
}

function parseImageItem(item, label, isUpdate) {
  if (!isPlainObject(item)) throw bad(`${label} inválido`);

  const enabled = optionalBoolean(item.enabled, `${label}.enabled`);

  // Sem id: imagem nova (type + content em base64).
  if (item.id === undefined) {
    if (item.deleted !== undefined) {
      throw bad(`${label}: "deleted" exige o id da imagem`);
    }
    return {
      op: "create",
      enabled,
      extension: requireImageType(item.type, label),
      buffer: media.decodeBase64Image(item.content, label),
    };
  }

  if (!isUpdate) {
    throw bad(`${label}: id não é permitido no cadastro`);
  }
  const id = parsePositiveInt(item.id, `${label}.id`);

  if (item.deleted !== undefined && typeof item.deleted !== "boolean") {
    throw bad(`${label}.deleted deve ser true ou false`);
  }
  if (item.deleted === true) return { op: "delete", id };

  if (item.content === undefined) return { op: "keep", id, enabled };

  if (typeof item.content !== "string" || item.content.trim() === "") {
    throw bad(`${label}.content inválido`);
  }

  // Base64: troca o arquivo da imagem. Se "type" não vier, mantém a extensão atual.
  if (media.looksLikeBase64(item.content)) {
    return {
      op: "replace",
      id,
      enabled,
      extension:
        item.type === undefined
          ? undefined
          : requireImageType(item.type, label),
      buffer: media.decodeBase64Image(item.content, label),
    };
  }

  // URL ou caminho da imagem atual: nenhuma troca de arquivo.
  return { op: "keep", id, enabled, reference: item.content.trim() };
}

function parseImages(value, isUpdate) {
  if (!Array.isArray(value)) throw bad("images deve ser uma lista");
  const items = value.map((item, index) =>
    parseImageItem(item, `images[${index}]`, isUpdate),
  );
  assertUniqueIds(items, "images");
  return items;
}

// ---------- Opções ----------

function parseRadius(value, label) {
  if (Number.isInteger(value) && value >= 0) return value;
  if (typeof value === "string") {
    const found = /^(\d+)(px)?$/i.exec(value.trim());
    if (found) return Number(found[1]);
  }
  throw bad(`${label}.radius deve ser um número ou um valor como "4px"`);
}

function parseValues(value, label) {
  if (!Array.isArray(value) || value.length === 0) {
    throw bad(`${label}.values deve ser uma lista com ao menos um valor`);
  }
  const values = value.map((item) => {
    if (typeof item !== "string" || item.trim() === "" || item.includes(",")) {
      throw bad(`${label}.values deve conter textos não vazios e sem vírgula`);
    }
    return item.trim();
  });
  const joined = values.join(",");
  if (joined.length > MAX_LENGTH) {
    throw bad(`${label}.values excede ${MAX_LENGTH} caracteres no total`);
  }
  return joined; // salvo no banco separado por vírgula
}

function parseOptionFields(item, label, isNew) {
  const fields = {};

  if (isNew || item.title !== undefined) {
    fields.title = requireText(item.title, `${label}.title`);
  }
  if (item.shape !== undefined) {
    if (!SHAPES.includes(item.shape)) {
      throw bad(`${label}.shape deve ser ${SHAPES.join(" ou ")}`);
    }
    fields.shape = item.shape;
  }
  if (item.type !== undefined) {
    if (!OPTION_TYPES.includes(item.type)) {
      throw bad(`${label}.type deve ser ${OPTION_TYPES.join(" ou ")}`);
    }
    fields.type = item.type;
  }
  if (item.radius !== undefined) {
    fields.radius = parseRadius(item.radius, label);
  }

  // Aceita "values" e também "value" (como aparece em alguns exemplos do escopo).
  const rawValues = item.values !== undefined ? item.values : item.value;
  if (isNew || rawValues !== undefined) {
    fields.values = parseValues(rawValues, label);
  }
  return fields;
}

function parseOptionItem(item, label, isUpdate) {
  if (!isPlainObject(item)) throw bad(`${label} inválido`);

  if (item.id === undefined) {
    if (item.deleted !== undefined) {
      throw bad(`${label}: "deleted" exige o id da opção`);
    }
    return { op: "create", fields: parseOptionFields(item, label, true) };
  }

  if (!isUpdate) {
    throw bad(`${label}: id não é permitido no cadastro`);
  }
  const id = parsePositiveInt(item.id, `${label}.id`);

  if (item.deleted !== undefined && typeof item.deleted !== "boolean") {
    throw bad(`${label}.deleted deve ser true ou false`);
  }
  if (item.deleted === true) return { op: "delete", id };

  return { op: "update", id, fields: parseOptionFields(item, label, false) };
}

function parseOptions(value, isUpdate) {
  if (!Array.isArray(value)) throw bad("options deve ser uma lista");
  const items = value.map((item, index) =>
    parseOptionItem(item, `options[${index}]`, isUpdate),
  );
  assertUniqueIds(items, "options");
  return items;
}

function assertUniqueIds(items, label) {
  const ids = items.filter((item) => item.id !== undefined).map((i) => i.id);
  if (new Set(ids).size !== ids.length) {
    throw bad(`${label} não pode repetir o mesmo id`);
  }
}

// ---------- Produto ----------

// Valida o corpo do POST (isUpdate = false) ou do PUT (isUpdate = true).
// Campos opcionais não enviados ficam undefined.
function parseProduct(body, { isUpdate }) {
  if (!isPlainObject(body)) {
    throw bad("O corpo da requisição deve ser um objeto JSON");
  }

  return {
    name: requireText(body.name, "name"),
    slug: requireText(body.slug, "slug"),
    price: requireMoney(body.price, "price"),
    price_with_discount: requireMoney(
      body.price_with_discount,
      "price_with_discount",
    ),
    enabled: optionalBoolean(body.enabled, "enabled"),
    stock: optionalStock(body.stock),
    description: optionalDescription(body.description),
    category_ids: optionalCategoryIds(body.category_ids),
    images:
      body.images === undefined
        ? undefined
        : parseImages(body.images, isUpdate),
    options:
      body.options === undefined
        ? undefined
        : parseOptions(body.options, isUpdate),
  };
}

module.exports = { parseProduct };
