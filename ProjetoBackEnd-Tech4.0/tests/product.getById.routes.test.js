const request = require("supertest");
const app = require("../src/app");
const {
  sequelize,
  Category,
  Product,
  ProductCategory,
  ProductImage,
  ProductOption,
} = require("../src/models");

async function clearAll() {
  await ProductCategory.destroy({ where: {} });
  await ProductImage.destroy({ where: {} });
  await ProductOption.destroy({ where: {} });
  await Product.destroy({ where: {} });
  await Category.destroy({ where: {} });
}

beforeAll(async () => {
  await sequelize.sync({ force: true });
});

afterEach(async () => {
  await clearAll();
});

afterAll(async () => {
  await sequelize.close();
});

describe("GET /v1/product/:id", () => {
  it("retorna 200 com o produto completo, imagens, opções e category_ids", async () => {
    const shoes = await Category.create({ name: "Calçados", slug: "calcados" });
    const offers = await Category.create({ name: "Ofertas", slug: "ofertas" });

    const product = await Product.create({
      enabled: true,
      name: "Produto 01",
      slug: "product-01",
      stock: 10,
      description: "Descrição do produto 01",
      price: 119.9,
      price_with_discount: 99.9,
    });
    // Outro produto, para garantir que só os dados do produto pedido voltam.
    const other = await Product.create({
      name: "Produto 02",
      slug: "product-02",
      price: 10,
      price_with_discount: 5,
    });

    await ProductCategory.bulkCreate([
      { product_id: product.id, category_id: offers.id },
      { product_id: product.id, category_id: shoes.id },
      { product_id: other.id, category_id: shoes.id },
    ]);

    const image1 = await ProductImage.create({
      product_id: product.id,
      path: "media/product-01/image-01.png",
    });
    const image2 = await ProductImage.create({
      product_id: product.id,
      path: "media/product-01/image-02.jpg",
    });
    await ProductImage.create({
      product_id: other.id,
      path: "media/product-02/image-01.png",
    });

    const size = await ProductOption.create({
      product_id: product.id,
      title: "Tamanho",
      values: "P,M,G",
    });
    const color = await ProductOption.create({
      product_id: product.id,
      title: "Cor",
      type: "color",
      shape: "circle",
      radius: 50,
      values: "#fff,#000",
    });
    await ProductOption.create({
      product_id: other.id,
      title: "Outra",
      values: "X",
    });

    const res = await request(app).get(`/v1/product/${product.id}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      id: product.id,
      enabled: true,
      name: "Produto 01",
      slug: "product-01",
      stock: 10,
      description: "Descrição do produto 01",
      price: 119.9,
      price_with_discount: 99.9,
      category_ids: [shoes.id, offers.id].sort((a, b) => a - b),
      images: [
        { id: image1.id, content: "media/product-01/image-01.png" },
        { id: image2.id, content: "media/product-01/image-02.jpg" },
      ],
      options: [
        {
          id: size.id,
          title: "Tamanho",
          shape: "square",
          radius: 0,
          type: "text",
          values: ["P", "M", "G"],
        },
        {
          id: color.id,
          title: "Cor",
          shape: "circle",
          radius: 50,
          type: "color",
          values: ["#fff", "#000"],
        },
      ],
    });
  });

  it("usa valores padrão e listas vazias quando não há dados relacionados", async () => {
    const product = await Product.create({
      name: "Produto Simples",
      slug: "produto-simples",
      price: 20,
      price_with_discount: 15,
    });

    const res = await request(app).get(`/v1/product/${product.id}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      id: product.id,
      enabled: false,
      name: "Produto Simples",
      slug: "produto-simples",
      stock: 0,
      description: null,
      price: 20,
      price_with_discount: 15,
      category_ids: [],
      images: [],
      options: [],
    });
  });

  it("retorna 404 quando o produto não existe", async () => {
    const res = await request(app).get("/v1/product/9999");
    expect(res.status).toBe(404);
  });

  it.each(["abc", "0", "-1", "1.5"])(
    "retorna 404 quando o id é inválido (%s)",
    async (id) => {
      const res = await request(app).get(`/v1/product/${id}`);
      expect(res.status).toBe(404);
    },
  );

  it("não confunde /search com um id", async () => {
    const res = await request(app).get("/v1/product/search");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("data");
  });
});
