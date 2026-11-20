const {
  sequelize,
  Product,
  Category,
  ProductCategory,
} = require("../src/models");

let product;
let category;

beforeAll(async () => {
  await sequelize.sync({ force: true });
  product = await Product.create({
    name: "Camiseta Azul",
    slug: "camiseta-azul",
    price: 100,
    price_with_discount: 80,
  });
  category = await Category.create({ name: "Camisetas", slug: "camisetas" });
});

afterEach(async () => {
  await ProductCategory.destroy({ where: {} });
});

afterAll(async () => {
  await sequelize.close();
});

describe("Model ProductCategory", () => {
  it("possui as colunas esperadas", () => {
    expect(Object.keys(ProductCategory.rawAttributes)).toEqual(
      expect.arrayContaining([
        "product_id",
        "category_id",
        "created_at",
        "updated_at",
      ]),
    );
  });

  it("associa um produto a uma categoria", async () => {
    await ProductCategory.create({
      product_id: product.id,
      category_id: category.id,
    });
    const found = await Product.findByPk(product.id, { include: "categories" });
    expect(found.categories).toHaveLength(1);
    expect(found.categories[0].id).toBe(category.id);
  });

  it.each(["product_id", "category_id"])("exige o campo %s", async (field) => {
    const data = { product_id: product.id, category_id: category.id };
    delete data[field];
    await expect(ProductCategory.create(data)).rejects.toThrow();
  });

  it("rejeita product_id ou category_id inexistentes", async () => {
    await expect(
      ProductCategory.create({ product_id: 9999, category_id: category.id }),
    ).rejects.toThrow();
    await expect(
      ProductCategory.create({ product_id: product.id, category_id: 9999 }),
    ).rejects.toThrow();
  });
});
