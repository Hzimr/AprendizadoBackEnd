const { Op, Sequelize } = require("sequelize");
const {
  Product,
  ProductImage,
  ProductOption,
  ProductCategory,
} = require("../models");
const AppError = require("./AppError");
const { parseLimit, parsePage } = require("./queryParams");

const SCALAR_FIELDS = [
  "id",
  "enabled",
  "name",
  "slug",
  "stock",
  "description",
  "price",
  "price_with_discount",
];
const RELATION_FIELDS = ["category_ids", "images", "options"];
const ALLOWED_FIELDS = [...SCALAR_FIELDS, ...RELATION_FIELDS];

const ID_LIST_REGEX = /^\d+(,\d+)*$/;
const PRICE_RANGE_REGEX = /^(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)$/;
const OPTION_KEY_PREFIX = "option[";
const OPTION_KEY_REGEX = /^option\[(\d+)\]$/;

const splitValues = (text) =>
  String(text)
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

// ---------- Leitura e validação da query string ----------

function parseFields(value) {
  if (value === undefined) return ALLOWED_FIELDS;
  if (typeof value !== "string") {
    throw new AppError(400, "fields inválido");
  }
  const fields = [...new Set(value.split(",").map((field) => field.trim()))];
  const invalid = fields.filter((field) => !ALLOWED_FIELDS.includes(field));
  if (invalid.length > 0) {
    throw new AppError(
      400,
      `fields inválido. Campos permitidos: ${ALLOWED_FIELDS.join(", ")}`,
    );
  }
  return fields;
}

function parseMatch(value) {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.trim() === "") {
    throw new AppError(400, "match não pode ser vazio");
  }
  return value.trim();
}

function parseCategoryIds(value) {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !ID_LIST_REGEX.test(value)) {
    throw new AppError(
      400,
      "category_ids deve ser uma lista de ids, ex.: 15,24",
    );
  }
  const ids = [...new Set(value.split(",").map(Number))];
  if (ids.some((id) => id < 1)) {
    throw new AppError(400, "category_ids deve conter ids maiores que zero");
  }
  return ids;
}

function parsePriceRange(value) {
  if (value === undefined) return undefined;
  const found =
    typeof value === "string" ? PRICE_RANGE_REGEX.exec(value) : null;
  if (!found) {
    throw new AppError(400, "price-range deve ter o formato 100-200");
  }
  const min = Number(found[1]);
  const max = Number(found[2]);
  if (min > max) {
    throw new AppError(400, "price-range: o valor mínimo excede o máximo");
  }
  return { min, max };
}

// option[45]=GG,PP  =>  Map { 45 => ['gg', 'pp'] }
function parseOptions(query) {
  const options = new Map();

  Object.keys(query)
    .filter((key) => key.startsWith(OPTION_KEY_PREFIX))
    .forEach((key) => {
      const found = OPTION_KEY_REGEX.exec(key);
      if (!found || Number(found[1]) < 1) {
        throw new AppError(
          400,
          `${key} inválido. Use option[<id da opção>]=a,b`,
        );
      }

      const raw = query[key];
      const values = typeof raw === "string" ? splitValues(raw) : [];
      if (values.length === 0) {
        throw new AppError(400, `${key} deve informar ao menos um valor`);
      }
      options.set(
        Number(found[1]),
        values.map((value) => value.toLowerCase()),
      );
    });

  return options.size > 0 ? options : undefined;
}

// ---------- Filtros que dependem de outras tabelas (retornam ids de produtos) ----------

async function productIdsFromCategories(categoryIds) {
  const rows = await ProductCategory.findAll({
    where: { category_id: { [Op.in]: categoryIds } },
    attributes: ["product_id"],
    raw: true,
  });
  return rows.map((row) => row.product_id);
}

// Produtos que possuem a opção informada com ao menos um dos valores pedidos.
async function productIdsFromOptions(options) {
  const rows = await ProductOption.findAll({
    where: { id: { [Op.in]: [...options.keys()] } },
    attributes: ["id", "product_id", "values"],
    raw: true,
  });

  return rows
    .filter((row) => {
      const wanted = options.get(row.id);
      const available = splitValues(row.values).map((value) =>
        value.toLowerCase(),
      );
      return wanted.some((value) => available.includes(value));
    })
    .map((row) => row.product_id);
}

function groupBy(rows, key) {
  const groups = new Map();
  rows.forEach((row) => {
    const list = groups.get(row[key]) || [];
    list.push(row);
    groups.set(row[key], list);
  });
  return groups;
}

// ---------- Busca ----------

async function search(query = {}) {
  const limit = parseLimit(query.limit);
  const page = parsePage(query.page);
  const fields = parseFields(query.fields);
  const match = parseMatch(query.match);
  const categoryIds = parseCategoryIds(query.category_ids);
  const priceRange = parsePriceRange(query["price-range"]);
  const options = parseOptions(query);

  const empty = { data: [], total: 0, limit, page };
  const conditions = [];

  if (match) {
    const pattern = `%${match.toLowerCase()}%`;
    conditions.push({
      [Op.or]: [
        Sequelize.where(
          Sequelize.fn("LOWER", Sequelize.col("name")),
          "LIKE",
          pattern,
        ),
        Sequelize.where(
          Sequelize.fn("LOWER", Sequelize.col("description")),
          "LIKE",
          pattern,
        ),
      ],
    });
  }

  if (priceRange) {
    conditions.push({
      price: { [Op.between]: [priceRange.min, priceRange.max] },
    });
  }

  // Filtros por categoria e por opção: cada um gera uma lista de ids de
  // produtos; o produto precisa estar em todas as listas informadas.
  const idLists = [];
  if (categoryIds) idLists.push(await productIdsFromCategories(categoryIds));
  if (options) idLists.push(await productIdsFromOptions(options));

  if (idLists.length > 0) {
    let allowedIds = null;
    idLists.forEach((ids) => {
      const set = new Set(ids);
      allowedIds =
        allowedIds === null ? [...set] : allowedIds.filter((id) => set.has(id));
    });
    if (allowedIds.length === 0) return empty;
    conditions.push({ id: { [Op.in]: allowedIds } });
  }

  // 1) Página de produtos (sem joins, então limit/offset ficam corretos).
  const queryAttributes = [
    "id",
    ...SCALAR_FIELDS.filter(
      (field) => field !== "id" && fields.includes(field),
    ),
  ];
  const findOptions = {
    where: conditions.length > 0 ? { [Op.and]: conditions } : {},
    attributes: queryAttributes,
    order: [["id", "ASC"]],
    raw: true,
  };
  // Com limit = -1 busca todos os itens e a paginação não tem efeito.
  if (limit !== -1) {
    findOptions.limit = limit;
    findOptions.offset = (page - 1) * limit;
  }

  const { rows, count } = await Product.findAndCountAll(findOptions);
  if (rows.length === 0) return { data: [], total: count, limit, page };

  // 2) Dados relacionados, só dos produtos desta página e só se pedidos.
  const productIds = rows.map((row) => row.id);
  const inPage = { [Op.in]: productIds };

  const categoriesByProduct = fields.includes("category_ids")
    ? groupBy(
        await ProductCategory.findAll({
          where: { product_id: inPage },
          attributes: ["product_id", "category_id"],
          raw: true,
        }),
        "product_id",
      )
    : new Map();

  const imagesByProduct = fields.includes("images")
    ? groupBy(
        await ProductImage.findAll({
          where: { product_id: inPage },
          attributes: ["id", "product_id", "path"],
          order: [["id", "ASC"]],
          raw: true,
        }),
        "product_id",
      )
    : new Map();

  const optionsByProduct = fields.includes("options")
    ? groupBy(
        await ProductOption.findAll({
          where: { product_id: inPage },
          attributes: [
            "id",
            "product_id",
            "title",
            "shape",
            "radius",
            "type",
            "values",
          ],
          order: [["id", "ASC"]],
          raw: true,
        }),
        "product_id",
      )
    : new Map();

  // 3) Monta a resposta com os campos pedidos.
  const data = rows.map((row) => {
    const item = {};
    fields.forEach((field) => {
      switch (field) {
        case "enabled":
          item.enabled = Boolean(row.enabled);
          break;
        case "category_ids":
          item.category_ids = (categoriesByProduct.get(row.id) || [])
            .map((link) => link.category_id)
            .sort((a, b) => a - b);
          break;
        case "images":
          item.images = (imagesByProduct.get(row.id) || []).map((image) => ({
            id: image.id,
            content: image.path,
          }));
          break;
        case "options":
          item.options = (optionsByProduct.get(row.id) || []).map((option) => ({
            id: option.id,
            title: option.title,
            shape: option.shape,
            radius: option.radius,
            type: option.type,
            values: splitValues(option.values),
          }));
          break;
        default:
          item[field] = row[field];
      }
    });
    return item;
  });

  return { data, total: count, limit, page };
}

module.exports = { search };
