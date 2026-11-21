const { Op } = require("sequelize");
const {
  sequelize,
  Product,
  Category,
  ProductCategory,
  ProductImage,
  ProductOption,
} = require("../models");
const AppError = require("./AppError");
const { getById } = require("./productService");
const { parseProduct } = require("./productPayload");
const media = require("./mediaService");

const SCALAR_FIELDS = [
  "enabled",
  "name",
  "slug",
  "stock",
  "description",
  "price",
  "price_with_discount",
];

// Remove as chaves com valor undefined (campos que o cliente não enviou).
const compact = (object) =>
  Object.fromEntries(
    Object.entries(object).filter(([, value]) => value !== undefined),
  );

const pickScalars = (data) =>
  compact(
    Object.fromEntries(SCALAR_FIELDS.map((field) => [field, data[field]])),
  );

const isUrl = (text) => /^https?:\/\//i.test(text);

// Id inválido (não numérico, zero, negativo) equivale a recurso inexistente.
async function findProductOrFail(rawId) {
  const id = Number(rawId);
  const product =
    Number.isInteger(id) && id >= 1 ? await Product.findByPk(id) : null;
  if (!product) {
    throw new AppError(404, "Produto não encontrado");
  }
  return product;
}

async function assertCategoriesExist(categoryIds) {
  if (!categoryIds || categoryIds.length === 0) return;
  const found = await Category.count({
    where: { id: { [Op.in]: categoryIds } },
  });
  if (found !== categoryIds.length) {
    throw new AppError(400, "category_ids contém categorias que não existem");
  }
}

async function replaceCategories(productId, categoryIds, transaction) {
  await ProductCategory.destroy({
    where: { product_id: productId },
    transaction,
  });
  if (categoryIds.length > 0) {
    await ProductCategory.bulkCreate(
      categoryIds.map((categoryId) => ({
        product_id: productId,
        category_id: categoryId,
      })),
      { transaction },
    );
  }
}

// Cria a linha da imagem e grava o arquivo. Retorna o caminho salvo.
async function createImage(productId, image, transaction) {
  const imagePath = media.newImagePath(productId, image.extension);
  await ProductImage.create(
    compact({ product_id: productId, path: imagePath, enabled: image.enabled }),
    { transaction },
  );
  await media.writeImage(imagePath, image.buffer);
  return imagePath;
}

// ---------- POST /v1/product ----------

async function create(body) {
  const data = parseProduct(body, { isUpdate: false });
  await assertCategoriesExist(data.category_ids);

  const writtenFiles = [];
  let productId;

  try {
    productId = await sequelize.transaction(async (transaction) => {
      const product = await Product.create(pickScalars(data), { transaction });

      await replaceCategories(product.id, data.category_ids || [], transaction);

      for (const image of data.images || []) {
        writtenFiles.push(await createImage(product.id, image, transaction));
      }

      for (const option of data.options || []) {
        await ProductOption.create(
          { product_id: product.id, ...option.fields },
          { transaction },
        );
      }

      return product.id;
    });
  } catch (error) {
    await media.removeImages(writtenFiles); // desfaz arquivos se o banco falhou
    throw error;
  }

  return getById(productId);
}

// ---------- PUT /v1/product/:id ----------

function assertImagesBelongToProduct(imageOps, currentImages) {
  (imageOps || []).forEach((op) => {
    if (op.id === undefined) return;

    const current = currentImages.get(op.id);
    if (!current) {
      throw new AppError(400, `A imagem ${op.id} não pertence a este produto`);
    }
    // "keep" com content: aceita uma URL ou o caminho atual da imagem.
    if (op.reference && !isUrl(op.reference) && op.reference !== current.path) {
      throw new AppError(
        400,
        `images: o content da imagem ${op.id} deve ser base64, uma URL ou o caminho atual`,
      );
    }
  });
}

function assertOptionsBelongToProduct(optionOps, currentOptionIds) {
  (optionOps || []).forEach((op) => {
    if (op.id !== undefined && !currentOptionIds.has(op.id)) {
      throw new AppError(400, `A opção ${op.id} não pertence a este produto`);
    }
  });
}

async function update(rawId, body) {
  const product = await findProductOrFail(rawId);
  const data = parseProduct(body, { isUpdate: true });
  await assertCategoriesExist(data.category_ids);

  const currentImages = new Map(
    (
      await ProductImage.findAll({
        where: { product_id: product.id },
        raw: true,
      })
    ).map((image) => [image.id, image]),
  );
  const currentOptionIds = new Set(
    (
      await ProductOption.findAll({
        where: { product_id: product.id },
        attributes: ["id"],
        raw: true,
      })
    ).map((option) => option.id),
  );

  assertImagesBelongToProduct(data.images, currentImages);
  assertOptionsBelongToProduct(data.options, currentOptionIds);

  const writtenFiles = []; // arquivos novos (apagados se o banco falhar)
  const obsoleteFiles = []; // arquivos antigos (apagados só depois do commit)

  try {
    await sequelize.transaction(async (transaction) => {
      await product.update(pickScalars(data), { transaction });

      if (data.category_ids !== undefined) {
        await replaceCategories(product.id, data.category_ids, transaction);
      }

      for (const op of data.images || []) {
        const current = currentImages.get(op.id);
        const where = { id: op.id, product_id: product.id };

        if (op.op === "create") {
          writtenFiles.push(await createImage(product.id, op, transaction));
        } else if (op.op === "delete") {
          await ProductImage.destroy({ where, transaction });
          obsoleteFiles.push(current.path);
        } else if (op.op === "replace") {
          const extension =
            op.extension || media.extensionOf(current.path) || "png";
          const newPath = media.newImagePath(product.id, extension);
          await ProductImage.update(
            compact({ path: newPath, enabled: op.enabled }),
            { where, transaction },
          );
          await media.writeImage(newPath, op.buffer);
          writtenFiles.push(newPath);
          obsoleteFiles.push(current.path);
        } else if (op.enabled !== undefined) {
          await ProductImage.update(
            { enabled: op.enabled },
            { where, transaction },
          );
        }
      }

      for (const op of data.options || []) {
        const where = { id: op.id, product_id: product.id };

        if (op.op === "create") {
          await ProductOption.create(
            { product_id: product.id, ...op.fields },
            { transaction },
          );
        } else if (op.op === "delete") {
          await ProductOption.destroy({ where, transaction });
        } else if (Object.keys(op.fields).length > 0) {
          await ProductOption.update(op.fields, { where, transaction });
        }
      }
    });
  } catch (error) {
    await media.removeImages(writtenFiles);
    throw error;
  }

  await media.removeImages(obsoleteFiles);
}

// ---------- DELETE /v1/product/:id ----------

async function remove(rawId) {
  const product = await findProductOrFail(rawId);
  const images = await ProductImage.findAll({
    where: { product_id: product.id },
    attributes: ["path"],
    raw: true,
  });

  await sequelize.transaction(async (transaction) => {
    const where = { product_id: product.id };
    await ProductCategory.destroy({ where, transaction });
    await ProductImage.destroy({ where, transaction });
    await ProductOption.destroy({ where, transaction });
    await product.destroy({ transaction });
  });

  await media.removeImages(images.map((image) => image.path));
}

module.exports = { create, update, remove };
