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

const SEARCH = "/v1/product/search";
const pad = (n) => String(n).padStart(2, "0");

async function clearAll() {
  await ProductCategory.destroy({ where: {} });
  await ProductImage.destroy({ where: {} });
  await ProductOption.destroy({ where: {} });
  await Product.destroy({ where: {} });
  await Category.destroy({ where: {} });
}

// Catálogo pequeno e variado para testar filtros e formato da resposta.
async function seedCatalog() {
  const shoes = await Category.create({ name: "Calçados", slug: "calcados" });
  const offers = await Category.create({
    name: "Promoções",
    slug: "promocoes",
  });

  const runner = await Product.create({
    enabled: true,
    name: "Tênis Runner",
    slug: "tenis-runner",
    stock: 10,
    description: "Para corrida",
    price: 100,
    price_with_discount: 90,
  });
  const shirt = await Product.create({
    name: "Camiseta Azul",
    slug: "camiseta-azul",
    description: "Combina com um tênis casual",
    price: 50,
    price_with_discount: 40,
  });
  const boot = await Product.create({
    name: "Bota Preta",
    slug: "bota-preta",
    price: 200,
    price_with_discount: 180,
  });
  const casual = await Product.create({
    name: "Tênis Casual",
    slug: "tenis-casual",
    description: "Uso diário",
    price: 150,
    price_with_discount: 120,
  });

  await ProductCategory.bulkCreate([
    { product_id: runner.id, category_id: shoes.id },
    { product_id: casual.id, category_id: shoes.id },
    { product_id: boot.id, category_id: offers.id },
    { product_id: casual.id, category_id: offers.id },
  ]);

  const image1 = await ProductImage.create({
    product_id: runner.id,
    path: "media/runner-1.png",
  });
  const image2 = await ProductImage.create({
    product_id: runner.id,
    path: "media/runner-2.png",
  });

  const runnerSize = await ProductOption.create({
    product_id: runner.id,
    title: "Tamanho",
    values: "PP,P,M,GG",
  });
  const bootSize = await ProductOption.create({
    product_id: boot.id,
    title: "Tamanho",
    values: "M,G",
  });
  const casualColor = await ProductOption.create({
    product_id: casual.id,
    title: "Cor",
    type: "color",
    shape: "circle",
    radius: 50,
    values: "#fff,#000",
  });

  return {
    shoes,
    offers,
    runner,
    shirt,
    boot,
    casual,
    image1,
    image2,
    runnerSize,
    bootSize,
    casualColor,
  };
}

const names = (res) => res.body.data.map((product) => product.name);

beforeAll(async () => {
  await sequelize.sync({ force: true });
});

afterEach(async () => {
  await clearAll();
});

afterAll(async () => {
  await sequelize.close();
});

describe("GET /v1/product/search - formato da resposta", () => {
  it("retorna os produtos com todos os campos, imagens, opções e category_ids", async () => {
    const seed = await seedCatalog();
    const res = await request(app).get(`${SEARCH}?limit=-1`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(4);
    expect(res.body.limit).toBe(-1);
    expect(res.body.page).toBe(1);
    expect(res.body.data).toHaveLength(4);

    const runner = res.body.data.find((p) => p.id === seed.runner.id);
    expect(runner).toEqual({
      id: seed.runner.id,
      enabled: true,
      name: "Tênis Runner",
      slug: "tenis-runner",
      stock: 10,
      description: "Para corrida",
      price: 100,
      price_with_discount: 90,
      category_ids: [seed.shoes.id],
      images: [
        { id: seed.image1.id, content: "media/runner-1.png" },
        { id: seed.image2.id, content: "media/runner-2.png" },
      ],
      options: [
        {
          id: seed.runnerSize.id,
          title: "Tamanho",
          shape: "square",
          radius: 0,
          type: "text",
          values: ["PP", "P", "M", "GG"],
        },
      ],
    });
  });

  it("usa valores padrão e listas vazias quando o produto não tem dados relacionados", async () => {
    const seed = await seedCatalog();
    const res = await request(app).get(`${SEARCH}?limit=-1`);

    const shirt = res.body.data.find((p) => p.id === seed.shirt.id);
    expect(shirt.enabled).toBe(false);
    expect(shirt.stock).toBe(0);
    expect(shirt.category_ids).toEqual([]);
    expect(shirt.images).toEqual([]);
    expect(shirt.options).toEqual([]);

    const boot = res.body.data.find((p) => p.id === seed.boot.id);
    expect(boot.description).toBeNull();
  });

  it("retorna lista vazia quando não há produtos", async () => {
    const res = await request(app).get(SEARCH);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: [], total: 0, limit: 12, page: 1 });
  });
});

describe("GET /v1/product/search - paginação", () => {
  beforeEach(async () => {
    await Product.bulkCreate(
      Array.from({ length: 15 }, (_, i) => ({
        name: `Produto ${pad(i + 1)}`,
        slug: `produto-${pad(i + 1)}`,
        price: 10 + i,
        price_with_discount: 5 + i,
      })),
    );
  });

  it("usa limit=12 e page=1 por padrão", async () => {
    const res = await request(app).get(SEARCH);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(12);
    expect(res.body.total).toBe(15);
    expect(res.body.limit).toBe(12);
    expect(res.body.page).toBe(1);
  });

  it("pagina com limit e page", async () => {
    const res = await request(app).get(`${SEARCH}?limit=5&page=2`);

    expect(names(res)).toEqual([
      "Produto 06",
      "Produto 07",
      "Produto 08",
      "Produto 09",
      "Produto 10",
    ]);
    expect(res.body.total).toBe(15);
    expect(res.body.limit).toBe(5);
    expect(res.body.page).toBe(2);
  });

  it("retorna lista vazia quando a página passa do fim", async () => {
    const res = await request(app).get(`${SEARCH}?limit=5&page=10`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.total).toBe(15);
  });

  it("limit=-1 retorna todos e ignora page", async () => {
    const res = await request(app).get(`${SEARCH}?limit=-1&page=3`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(15);
    expect(res.body.limit).toBe(-1);
  });
});

describe("GET /v1/product/search - fields", () => {
  it("limita os campos retornados", async () => {
    await seedCatalog();
    const res = await request(app).get(`${SEARCH}?fields=name,price&limit=-1`);

    expect(res.status).toBe(200);
    res.body.data.forEach((product) => {
      expect(Object.keys(product).sort()).toEqual(["name", "price"]);
    });
  });

  it("inclui imagens quando pedidas", async () => {
    const seed = await seedCatalog();
    const res = await request(app).get(
      `${SEARCH}?fields=name,images,price&match=runner`,
    );

    expect(res.body.data).toEqual([
      {
        name: "Tênis Runner",
        images: [
          { id: seed.image1.id, content: "media/runner-1.png" },
          { id: seed.image2.id, content: "media/runner-2.png" },
        ],
        price: 100,
      },
    ]);
  });

  it("inclui category_ids e options quando pedidos", async () => {
    const seed = await seedCatalog();
    const res = await request(app).get(
      `${SEARCH}?fields=category_ids,options&match=casual&limit=-1`,
    );

    const casual = res.body.data.find((p) => p.options.length > 0);
    expect(casual.category_ids).toEqual([seed.shoes.id, seed.offers.id]);
    expect(casual.options[0]).toMatchObject({
      title: "Cor",
      type: "color",
      shape: "circle",
      radius: 50,
      values: ["#fff", "#000"],
    });
  });
});

describe("GET /v1/product/search - match", () => {
  it("encontra pelo nome ou pela descrição", async () => {
    await seedCatalog();
    // .query() cuida da codificação dos caracteres acentuados na URL.
    const res = await request(app).get(SEARCH).query({ match: "tênis" });

    expect(res.status).toBe(200);
    expect(names(res)).toEqual([
      "Tênis Runner",
      "Camiseta Azul",
      "Tênis Casual",
    ]);
    expect(res.body.total).toBe(3);
  });

  it("não diferencia maiúsculas de minúsculas", async () => {
    await seedCatalog();
    const res = await request(app).get(`${SEARCH}?match=RUNNER`);
    expect(names(res)).toEqual(["Tênis Runner"]);
  });

  it("encontra só pela descrição", async () => {
    await seedCatalog();
    const res = await request(app).get(SEARCH).query({ match: "diário" });
    expect(names(res)).toEqual(["Tênis Casual"]);
  });

  it("retorna vazio quando nada combina", async () => {
    await seedCatalog();
    const res = await request(app).get(`${SEARCH}?match=inexistente`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.total).toBe(0);
  });
});

describe("GET /v1/product/search - category_ids", () => {
  it("filtra por uma categoria", async () => {
    const seed = await seedCatalog();
    const res = await request(app).get(
      `${SEARCH}?category_ids=${seed.shoes.id}`,
    );
    expect(names(res)).toEqual(["Tênis Runner", "Tênis Casual"]);
  });

  it("filtra por várias categorias, sem repetir produtos", async () => {
    const seed = await seedCatalog();
    const res = await request(app).get(
      `${SEARCH}?category_ids=${seed.shoes.id},${seed.offers.id}`,
    );
    expect(names(res)).toEqual(["Tênis Runner", "Bota Preta", "Tênis Casual"]);
    expect(res.body.total).toBe(3);
  });

  it("retorna vazio para categoria sem produtos", async () => {
    await seedCatalog();
    const res = await request(app).get(`${SEARCH}?category_ids=99999`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });
});

describe("GET /v1/product/search - price-range", () => {
  it("filtra pela faixa de preço, com limites inclusivos", async () => {
    await seedCatalog();
    const res = await request(app).get(`${SEARCH}?price-range=100-150`);
    expect(names(res)).toEqual(["Tênis Runner", "Tênis Casual"]);
  });

  it("aceita valores decimais", async () => {
    await seedCatalog();
    const res = await request(app).get(`${SEARCH}?price-range=49.5-50.5`);
    expect(names(res)).toEqual(["Camiseta Azul"]);
  });
});

describe("GET /v1/product/search - option[id]", () => {
  it("filtra pelo valor da opção", async () => {
    const seed = await seedCatalog();
    const res = await request(app).get(
      `${SEARCH}?option[${seed.runnerSize.id}]=GG`,
    );
    expect(names(res)).toEqual(["Tênis Runner"]);
  });

  it("aceita vários valores (qualquer um deles)", async () => {
    const seed = await seedCatalog();
    const res = await request(app).get(
      `${SEARCH}?option[${seed.runnerSize.id}]=XL,PP`,
    );
    expect(names(res)).toEqual(["Tênis Runner"]);
  });

  it("compara o valor inteiro: G não casa com GG", async () => {
    const seed = await seedCatalog();
    const res = await request(app).get(
      `${SEARCH}?option[${seed.runnerSize.id}]=G`,
    );
    expect(res.body.data).toEqual([]);
  });

  it("combina várias opções (qualquer uma delas)", async () => {
    const seed = await seedCatalog();
    const res = await request(app).get(
      `${SEARCH}?option[${seed.runnerSize.id}]=GG&option[${seed.bootSize.id}]=G`,
    );
    expect(names(res)).toEqual(["Tênis Runner", "Bota Preta"]);
  });
});

describe("GET /v1/product/search - filtros combinados", () => {
  it("aplica todos os filtros ao mesmo tempo", async () => {
    const seed = await seedCatalog();
    const res = await request(app)
      .get(SEARCH)
      .query({
        match: "tênis",
        category_ids: String(seed.offers.id),
        "price-range": "100-200",
        fields: "name",
      });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([{ name: "Tênis Casual" }]);
    expect(res.body.total).toBe(1);
  });

  it("retorna vazio quando os filtros não têm produto em comum", async () => {
    const seed = await seedCatalog();
    const res = await request(app).get(
      `${SEARCH}?category_ids=${seed.offers.id}&option[${seed.runnerSize.id}]=GG`,
    );
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.total).toBe(0);
  });
});

describe("GET /v1/product/search - requisições inválidas", () => {
  it.each([
    ["limit=0"],
    ["limit=-5"],
    ["limit=abc"],
    ["page=0"],
    ["page=abc"],
    ["fields=name,foo"],
    ["fields="],
    ["match="],
    ["category_ids=abc"],
    ["category_ids=1,,2"],
    ["category_ids=0"],
    ["price-range=abc"],
    ["price-range=100"],
    ["price-range=200-100"],
    ["option[abc]=GG"],
    ["option[0]=GG"],
    ["option[1]="],
  ])("retorna 400 para %s", async (query) => {
    const res = await request(app).get(`${SEARCH}?${query}`);
    expect(res.status).toBe(400);
  });
});
