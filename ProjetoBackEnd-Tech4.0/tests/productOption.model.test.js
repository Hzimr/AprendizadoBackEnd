const { sequelize, Product, ProductOption } = require("../src/models");

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
  await ProductOption.destroy({ where: {} });
});

afterAll(async () => {
  await sequelize.close();
});

const validOption = () => ({
  product_id: product.id,
  title: "Tamanho",
  values: "P,M,G",
});

describe("Model ProductOption", () => {
  it("possui as colunas esperadas", () => {
    expect(Object.keys(ProductOption.rawAttributes)).toEqual(
      expect.arrayContaining([
        "id",
        "product_id",
        "title",
        "shape",
        "radius",
        "type",
        "values",
        "created_at",
        "updated_at",
      ]),
    );
    expect(ProductOption.rawAttributes.id.autoIncrement).toBe(true);
  });

  it("aplica os valores padrão (shape=square, radius=0, type=text)", async () => {
    const option = await ProductOption.create(validOption());
    expect(option.shape).toBe("square");
    expect(option.radius).toBe(0);
    expect(option.type).toBe("text");
    expect(option.get("values")).toBe("P,M,G");
  });

  it("aceita shape circle e type color", async () => {
    const option = await ProductOption.create({
      ...validOption(),
      shape: "circle",
      type: "color",
      radius: 50,
    });
    expect(option.shape).toBe("circle");
    expect(option.type).toBe("color");
    expect(option.radius).toBe(50);
  });

  it("rejeita valores inválidos em shape e type", async () => {
    await expect(
      ProductOption.create({ ...validOption(), shape: "triangle" }),
    ).rejects.toThrow();
    await expect(
      ProductOption.create({ ...validOption(), type: "number" }),
    ).rejects.toThrow();
  });

  it.each(["product_id", "title", "values"])(
    "exige o campo %s",
    async (field) => {
      const data = validOption();
      delete data[field];
      await expect(ProductOption.create(data)).rejects.toThrow();
    },
  );

  it("rejeita product_id que não existe na tabela de produtos", async () => {
    await expect(
      ProductOption.create({ ...validOption(), product_id: 9999 }),
    ).rejects.toThrow();
  });
});
