process.env.JWT_SECRET = "test-secret";

const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../src/app");
const { sequelize, User } = require("../src/models");

const credentials = { email: "maria@example.com", password: "123@123" };

async function createUser() {
  const res = await request(app)
    .post("/v1/user")
    .send({
      firstname: "Maria",
      surname: "Silva",
      ...credentials,
      confirmPassword: credentials.password,
    });
  expect(res.status).toBe(201);
  return res.body;
}

const requestToken = (body) => request(app).post("/v1/user/token").send(body);

beforeAll(async () => {
  await sequelize.sync({ force: true });
});

afterEach(async () => {
  await User.destroy({ where: {} });
});

afterAll(async () => {
  await sequelize.close();
});

describe("POST /v1/user/token", () => {
  it("retorna 200 com um JWT válido para credenciais corretas", async () => {
    const user = await createUser();
    const res = await requestToken(credentials);

    expect(res.status).toBe(200);
    expect(Object.keys(res.body)).toEqual(["token"]);
    expect(typeof res.body.token).toBe("string");

    const payload = jwt.verify(res.body.token, process.env.JWT_SECRET);
    expect(payload.id).toBe(user.id);
    expect(payload.email).toBe(credentials.email);
    expect(payload.exp).toBeGreaterThan(payload.iat);
    expect(payload.password).toBeUndefined();
  });

  it("o token gerado é aceito nas rotas protegidas", async () => {
    const user = await createUser();
    const { body } = await requestToken(credentials);

    const res = await request(app)
      .put(`/v1/user/${user.id}`)
      .set("Authorization", `Bearer ${body.token}`)
      .send({ firstname: "Ana", surname: "Souza", email: credentials.email });

    expect(res.status).toBe(204);
  });

  it("respeita JWT_EXPIRES_IN", async () => {
    await createUser();
    const previous = process.env.JWT_EXPIRES_IN;
    process.env.JWT_EXPIRES_IN = "2h";

    try {
      const { body } = await requestToken(credentials);
      const payload = jwt.verify(body.token, process.env.JWT_SECRET);
      expect(payload.exp - payload.iat).toBe(2 * 60 * 60);
    } finally {
      if (previous === undefined) delete process.env.JWT_EXPIRES_IN;
      else process.env.JWT_EXPIRES_IN = previous;
    }
  });

  it("retorna 400 para senha incorreta", async () => {
    await createUser();
    const res = await requestToken({ ...credentials, password: "errada" });
    expect(res.status).toBe(400);
    expect(res.body.token).toBeUndefined();
  });

  it("retorna 400 para email não cadastrado", async () => {
    const res = await requestToken(credentials);
    expect(res.status).toBe(400);
    expect(res.body.token).toBeUndefined();
  });

  it("usa a mesma mensagem para email inexistente e senha errada", async () => {
    await createUser();
    const wrongPassword = await requestToken({ ...credentials, password: "x" });
    const unknownEmail = await requestToken({
      email: "ninguem@example.com",
      password: "x",
    });
    expect(wrongPassword.body.message).toBe(unknownEmail.body.message);
  });

  it.each([
    ["sem email", { password: "123@123" }],
    ["sem password", { email: "maria@example.com" }],
    ["email vazio", { email: "  ", password: "123@123" }],
    ["password vazio", { email: "maria@example.com", password: "" }],
    ["email que não é texto", { email: 123, password: "123@123" }],
    ["password que não é texto", { email: "maria@example.com", password: 123 }],
    ["corpo vazio", {}],
  ])("retorna 400: %s", async (_, body) => {
    await createUser();
    const res = await requestToken(body);
    expect(res.status).toBe(400);
  });

  it("retorna 400 quando o JSON é inválido", async () => {
    const res = await request(app)
      .post("/v1/user/token")
      .set("Content-Type", "application/json")
      .send("{ invalido");
    expect(res.status).toBe(400);
  });

  it("não exige token para ser chamado", async () => {
    await createUser();
    const res = await requestToken(credentials); // sem header Authorization
    expect(res.status).toBe(200);
  });
});
