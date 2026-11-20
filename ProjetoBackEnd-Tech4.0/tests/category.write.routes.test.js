process.env.JWT_SECRET = "test-secret";

const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../src/app");
const { sequelize, Category } = require("../src/models");

const authHeader = () => ({
  Authorization: `Bearer ${jwt.sign({ id: 1 }, process.env.JWT_SECRET)}`,
});

const validPayload = () => ({
  name: "Shoes",
  slug: "shoes",
  use_in_menu: true,
});

beforeAll(async () => {
  await sequelize.sync({ force: true });
});

afterEach(async () => {
  await Category.destroy({ where: {} });
});

afterAll(async () => {
  await sequelize.close();
});

describe("POST /v1/category", () => {
  it("retorna 201 e salva a categoria", async () => {
    const res = await request(app)
      .post("/v1/category")
      .set(authHeader())
      .send(validPayload());

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      id: expect.any(Number),
      name: "Shoes",
      slug: "shoes",
      use_in_menu: true,
    });

    const saved = await Category.findByPk(res.body.id);
    expect(saved.name).toBe("Shoes");
  });

  it("usa use_in_menu=false quando não é enviado", async () => {
    const res = await request(app)
      .post("/v1/category")
      .set(authHeader())
      .send({ name: "Offers", slug: "offers" });

    expect(res.status).toBe(201);
    expect(res.body.use_in_menu).toBe(false);
  });

  it.each(["name", "slug"])(
    "retorna 400 quando %s não é enviado",
    async (field) => {
      const payload = validPayload();
      delete payload[field];
      const res = await request(app)
        .post("/v1/category")
        .set(authHeader())
        .send(payload);
      expect(res.status).toBe(400);
    },
  );

  it("retorna 400 quando use_in_menu não é booleano", async () => {
    const res = await request(app)
      .post("/v1/category")
      .set(authHeader())
      .send({ ...validPayload(), use_in_menu: "sim" });
    expect(res.status).toBe(400);
  });

  it("retorna 400 quando o JSON é inválido", async () => {
    const res = await request(app)
      .post("/v1/category")
      .set(authHeader())
      .set("Content-Type", "application/json")
      .send("{ invalido");
    expect(res.status).toBe(400);
  });

  it("retorna 401 sem token", async () => {
    const res = await request(app).post("/v1/category").send(validPayload());
    expect(res.status).toBe(401);
    expect(await Category.count()).toBe(0);
  });

  it("retorna 401 com token inválido", async () => {
    const res = await request(app)
      .post("/v1/category")
      .set("Authorization", "Bearer token-invalido")
      .send(validPayload());
    expect(res.status).toBe(401);
  });
});

describe("PUT /v1/category/:id", () => {
  const update = { name: "Sneakers", slug: "sneakers", use_in_menu: false };

  it("retorna 204 sem corpo e atualiza a categoria", async () => {
    const category = await Category.create(validPayload());
    const res = await request(app)
      .put(`/v1/category/${category.id}`)
      .set(authHeader())
      .send(update);

    expect(res.status).toBe(204);
    expect(res.text).toBe("");

    const saved = await Category.findByPk(category.id);
    expect(saved.name).toBe("Sneakers");
    expect(saved.slug).toBe("sneakers");
    expect(saved.use_in_menu).toBe(false);
  });

  it("mantém use_in_menu quando não é enviado", async () => {
    const category = await Category.create(validPayload());
    const res = await request(app)
      .put(`/v1/category/${category.id}`)
      .set(authHeader())
      .send({ name: "Sneakers", slug: "sneakers" });

    expect(res.status).toBe(204);
    const saved = await Category.findByPk(category.id);
    expect(saved.use_in_menu).toBe(true);
  });

  it("retorna 401 sem token", async () => {
    const category = await Category.create(validPayload());
    const res = await request(app)
      .put(`/v1/category/${category.id}`)
      .send(update);
    expect(res.status).toBe(401);
  });

  it("retorna 404 quando a categoria não existe", async () => {
    const res = await request(app)
      .put("/v1/category/9999")
      .set(authHeader())
      .send(update);
    expect(res.status).toBe(404);
  });

  it.each(["name", "slug"])(
    "retorna 400 quando %s não é enviado",
    async (field) => {
      const category = await Category.create(validPayload());
      const payload = { ...update };
      delete payload[field];
      const res = await request(app)
        .put(`/v1/category/${category.id}`)
        .set(authHeader())
        .send(payload);
      expect(res.status).toBe(400);
    },
  );

  it("retorna 400 quando use_in_menu não é booleano", async () => {
    const category = await Category.create(validPayload());
    const res = await request(app)
      .put(`/v1/category/${category.id}`)
      .set(authHeader())
      .send({ ...update, use_in_menu: "sim" });
    expect(res.status).toBe(400);
  });
});

describe("DELETE /v1/category/:id", () => {
  it("retorna 204 sem corpo e remove a categoria", async () => {
    const category = await Category.create(validPayload());
    const res = await request(app)
      .delete(`/v1/category/${category.id}`)
      .set(authHeader());

    expect(res.status).toBe(204);
    expect(res.text).toBe("");
    expect(await Category.findByPk(category.id)).toBeNull();
  });

  it("retorna 401 sem token", async () => {
    const category = await Category.create(validPayload());
    const res = await request(app).delete(`/v1/category/${category.id}`);
    expect(res.status).toBe(401);
    expect(await Category.findByPk(category.id)).not.toBeNull();
  });

  it("retorna 404 quando a categoria não existe", async () => {
    const res = await request(app)
      .delete("/v1/category/9999")
      .set(authHeader());
    expect(res.status).toBe(404);
  });
});
