const request = require("supertest");
const app = require("../src/app");
const { sequelize, Category } = require("../src/models");

const pad = (n) => String(n).padStart(2, "0");

// Cria 15 categorias: "Cat 01" ... "Cat 15". As ímpares aparecem no menu.
async function seed(total = 15) {
  const rows = Array.from({ length: total }, (_, i) => ({
    name: `Cat ${pad(i + 1)}`,
    slug: `cat-${pad(i + 1)}`,
    use_in_menu: (i + 1) % 2 === 1,
  }));
  return Category.bulkCreate(rows);
}

beforeAll(async () => {
  await sequelize.sync({ force: true });
});

afterEach(async () => {
  await Category.destroy({ where: {} });
});

afterAll(async () => {
  await sequelize.close();
});

describe("GET /v1/category/search", () => {
  it("usa limit=12 e page=1 por padrão", async () => {
    await seed();
    const res = await request(app).get("/v1/category/search");

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(12);
    expect(res.body.total).toBe(15);
    expect(res.body.limit).toBe(12);
    expect(res.body.page).toBe(1);
  });

  it("retorna os campos id, name, slug e use_in_menu", async () => {
    await seed(1);
    const res = await request(app).get("/v1/category/search");

    expect(Object.keys(res.body.data[0]).sort()).toEqual(
      ["id", "name", "slug", "use_in_menu"].sort(),
    );
    expect(res.body.data[0].use_in_menu).toBe(true);
  });

  it("pagina os resultados com limit e page", async () => {
    await seed();
    const res = await request(app).get("/v1/category/search?limit=5&page=2");

    expect(res.status).toBe(200);
    expect(res.body.data.map((c) => c.name)).toEqual([
      "Cat 06",
      "Cat 07",
      "Cat 08",
      "Cat 09",
      "Cat 10",
    ]);
    expect(res.body.total).toBe(15);
    expect(res.body.limit).toBe(5);
    expect(res.body.page).toBe(2);
  });

  it("retorna lista vazia quando a página passa do fim", async () => {
    await seed();
    const res = await request(app).get("/v1/category/search?limit=5&page=10");

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.total).toBe(15);
  });

  it("limit=-1 retorna todos os itens", async () => {
    await seed();
    const res = await request(app).get("/v1/category/search?limit=-1");

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(15);
    expect(res.body.limit).toBe(-1);
  });

  it("limit=-1 ignora o page", async () => {
    await seed();
    const res = await request(app).get("/v1/category/search?limit=-1&page=3");

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(15);
  });

  it("fields limita os campos retornados", async () => {
    await seed(3);
    const res = await request(app).get("/v1/category/search?fields=name,slug");

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(3);
    res.body.data.forEach((category) => {
      expect(Object.keys(category).sort()).toEqual(["name", "slug"]);
    });
  });

  it("use_in_menu=true retorna só as categorias do menu", async () => {
    await seed();
    const res = await request(app).get(
      "/v1/category/search?use_in_menu=true&limit=-1",
    );

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(8);
    expect(res.body.data).toHaveLength(8);
    res.body.data.forEach((category) => {
      expect(category.use_in_menu).toBe(true);
    });
  });

  it("combina filtro, campos e paginação", async () => {
    await seed();
    const res = await request(app).get(
      "/v1/category/search?use_in_menu=true&fields=name&limit=3&page=2",
    );

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([
      { name: "Cat 07" },
      { name: "Cat 09" },
      { name: "Cat 11" },
    ]);
    expect(res.body.total).toBe(8);
  });

  it.each([
    ["limit=0"],
    ["limit=-5"],
    ["limit=abc"],
    ["limit=1.5"],
    ["page=0"],
    ["page=-1"],
    ["page=abc"],
    ["fields=name,foo"],
    ["fields="],
    ["use_in_menu=talvez"],
  ])("retorna 400 para %s", async (query) => {
    const res = await request(app).get(`/v1/category/search?${query}`);
    expect(res.status).toBe(400);
  });
});

describe("GET /v1/category/:id", () => {
  it("retorna 200 com os dados da categoria", async () => {
    const [category] = await seed(1);
    const res = await request(app).get(`/v1/category/${category.id}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      id: category.id,
      name: "Cat 01",
      slug: "cat-01",
      use_in_menu: true,
    });
  });

  it("retorna 404 quando a categoria não existe", async () => {
    const res = await request(app).get("/v1/category/9999");
    expect(res.status).toBe(404);
  });

  it("retorna 404 quando o id não é numérico", async () => {
    const res = await request(app).get("/v1/category/abc");
    expect(res.status).toBe(404);
  });
});
