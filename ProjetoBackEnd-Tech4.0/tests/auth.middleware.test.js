process.env.JWT_SECRET = "test-secret";

const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../src/app");
const { sequelize, Category, Product } = require("../src/models");

// Todos os endpoints POST, PUT e DELETE que exigem token. Os POST levam um
// corpo válido: sem a proteção funcionando, eles responderiam 201 (e não 400).
const PROTECTED = [
  ["put", "/v1/user/1", {}],
  ["delete", "/v1/user/1", {}],
  ["post", "/v1/category", { name: "Calçados", slug: "calcados" }],
  ["put", "/v1/category/1", {}],
  ["delete", "/v1/category/1", {}],
  [
    "post",
    "/v1/product",
    { name: "Produto", slug: "produto", price: 10, price_with_discount: 5 },
  ],
  ["put", "/v1/product/1", {}],
  ["delete", "/v1/product/1", {}],
];

const send = (method, url, body) => request(app)[method](url).send(body);

beforeAll(async () => {
  await sequelize.sync({ force: true });
});

afterAll(async () => {
  await sequelize.close();
});

describe("Validação do token nos métodos POST, PUT e DELETE", () => {
  describe.each(PROTECTED)("%s %s", (method, url, body) => {
    it("retorna 400 sem o cabeçalho Authorization", async () => {
      const res = await send(method, url, body);
      expect(res.status).toBe(400);
    });

    it("retorna 400 quando o cabeçalho não está no formato Bearer", async () => {
      const headers = ["Basic abc123", "Bearer", "abc123", "Bearer a b"];

      for (const header of headers) {
        const res = await send(method, url, body).set("Authorization", header);
        expect(res.status).toBe(400);
      }
    });

    it("retorna 401 com token inválido", async () => {
      const res = await send(method, url, body).set(
        "Authorization",
        "Bearer token-invalido",
      );
      expect(res.status).toBe(401);
    });

    it("retorna 401 com token assinado por outra chave", async () => {
      const forged = jwt.sign({ id: 1 }, "outra-chave");
      const res = await send(method, url, body).set(
        "Authorization",
        `Bearer ${forged}`,
      );
      expect(res.status).toBe(401);
    });

    it("retorna 401 com token expirado", async () => {
      const expired = jwt.sign({ id: 1 }, process.env.JWT_SECRET, {
        expiresIn: -10,
      });
      const res = await send(method, url, body).set(
        "Authorization",
        `Bearer ${expired}`,
      );
      expect(res.status).toBe(401);
    });

    it("não é barrado pela autenticação com um token válido", async () => {
      const valid = jwt.sign({ id: 1 }, process.env.JWT_SECRET);
      const res = await send(method, url, body).set(
        "Authorization",
        `Bearer ${valid}`,
      );
      expect(res.status).not.toBe(401);
    });
  });

  it("não grava nada quando o token não é enviado", async () => {
    await send("post", "/v1/category", { name: "A", slug: "a" });
    await send("post", "/v1/product", {
      name: "P",
      slug: "p",
      price: 1,
      price_with_discount: 1,
    });

    expect(await Category.count()).toBe(0);
    expect(await Product.count()).toBe(0);
  });

  it('aceita "bearer" em minúsculas', async () => {
    const valid = jwt.sign({ id: 1 }, process.env.JWT_SECRET);
    const res = await send("delete", "/v1/category/9999", {}).set(
      "Authorization",
      `bearer ${valid}`,
    );
    expect(res.status).toBe(404); // passou pela autenticação
  });
});

describe("Endpoints que continuam públicos", () => {
  it("GET não exige token", async () => {
    const res = await request(app).get("/v1/category/search");
    expect(res.status).toBe(200);
  });

  it("POST /v1/user (cadastro) não exige token", async () => {
    const res = await request(app).post("/v1/user").send({
      firstname: "Maria",
      surname: "Silva",
      email: "publico@example.com",
      password: "123@123",
      confirmPassword: "123@123",
    });
    expect(res.status).toBe(201);
  });

  it("POST /v1/user/token não exige token", async () => {
    const res = await request(app)
      .post("/v1/user/token")
      .send({ email: "publico@example.com", password: "123@123" });
    expect(res.status).toBe(200);
  });
});
