const { sequelize, Product } = require("../src/models");

const validProduct = {
  name: "Camiseta Azul",
  slug: "camiseta-azul",
  price: 100,
  price_with_discount: 80,
};

beforeAll(async () => {
  await sequelize.sync({ force: true });
});

afterEach(async () => {
  await Product.destroy({ where: {} });
});

afterAll(async () => {
  await sequelize.close();
});

describe("Model Product", () => {
  it("possui as colunas esperadas, incluindo created_at e updated_at", () => {
    expect(Object.keys(Product.rawAttributes)).toEqual(
      expect.arrayContaining([
        "id",
        "enabled",
        "name",
        "slug",
        "use_in_menu",
        "stock",
        "description",
        "price",
        "price_with_discount",
        "created_at",
        "updated_at",
      ]),
    );
    expect(Product.rawAttributes.id.autoIncrement).toBe(true);
  });

  it("aplica os valores padrão (enabled=0, use_in_menu=0, stock=0)", async () => {
    const product = await Product.create(validProduct);
    expect(product.enabled).toBe(false);
    expect(product.use_in_menu).toBe(false);
    expect(product.stock).toBe(0);

    // description não tem valor padrão: o que vale é o que está no banco.
    await product.reload();
    expect(product.description).toBeNull();
  });

  it("preenche created_at e updated_at", async () => {
    const product = await Product.create(validProduct);
    expect(product.created_at).toBeInstanceOf(Date);
    expect(product.updated_at).toBeInstanceOf(Date);
  });

  it.each(["name", "slug", "price", "price_with_discount"])(
    "exige o campo %s",
    async (field) => {
      const data = { ...validProduct };
      delete data[field];
      await expect(Product.create(data)).rejects.toThrow();
    },
  );
});
