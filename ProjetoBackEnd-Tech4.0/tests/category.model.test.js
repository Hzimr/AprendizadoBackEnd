const { sequelize, Category } = require("../src/models");

const validCategory = { name: "Camisetas", slug: "camisetas" };

beforeAll(async () => {
  await sequelize.sync({ force: true });
});

afterEach(async () => {
  await Category.destroy({ where: {} });
});

afterAll(async () => {
  await sequelize.close();
});

describe("Model Category", () => {
  it("possui as colunas esperadas, incluindo created_at e updated_at", () => {
    expect(Object.keys(Category.rawAttributes)).toEqual(
      expect.arrayContaining([
        "id",
        "name",
        "slug",
        "use_in_menu",
        "created_at",
        "updated_at",
      ]),
    );
    expect(Category.rawAttributes.id.autoIncrement).toBe(true);
  });

  it("usa use_in_menu = false (0) por padrão", async () => {
    const category = await Category.create(validCategory);
    expect(category.use_in_menu).toBe(false);
  });

  it("preenche created_at e updated_at", async () => {
    const category = await Category.create(validCategory);
    expect(category.created_at).toBeInstanceOf(Date);
    expect(category.updated_at).toBeInstanceOf(Date);
  });

  it.each(["name", "slug"])("exige o campo %s", async (field) => {
    const data = { ...validCategory };
    delete data[field];
    await expect(Category.create(data)).rejects.toThrow();
  });
});
