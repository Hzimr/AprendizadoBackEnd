const { sequelize, Product, ProductImage } = require("../src/models");

let product;

beforeAll(async () => {
  await sequelize.sync({ force: true });
  product = await Product.create({
    name: "Camiseta Azul",
    slug: "camiseta-azul",
    price: 100,
    price_with_discount: 80,
  });
});

afterEach(async () => {
  await ProductImage.destroy({ where: {} });
});

afterAll(async () => {
  await sequelize.close();
});

describe("Model ProductImage", () => {
  it("possui as colunas esperadas", () => {
    expect(Object.keys(ProductImage.rawAttributes)).toEqual(
      expect.arrayContaining([
        "id",
        "product_id",
        "enabled",
        "path",
        "created_at",
        "updated_at",
      ]),
    );
    expect(ProductImage.rawAttributes.id.autoIncrement).toBe(true);
  });

  it("usa enabled = false (0) por padrão", async () => {
    const image = await ProductImage.create({
      product_id: product.id,
      path: "images/camiseta.png",
    });
    expect(image.enabled).toBe(false);
  });

  it("exige o campo path", async () => {
    await expect(
      ProductImage.create({ product_id: product.id }),
    ).rejects.toThrow();
  });

  it("rejeita product_id que não existe na tabela de produtos", async () => {
    await expect(
      ProductImage.create({ product_id: 9999, path: "images/x.png" }),
    ).rejects.toThrow();
  });

  it("associa a imagem ao produto", async () => {
    await ProductImage.create({ product_id: product.id, path: "images/a.png" });
    const found = await Product.findByPk(product.id, { include: "images" });
    expect(found.images).toHaveLength(1);
  });
});
