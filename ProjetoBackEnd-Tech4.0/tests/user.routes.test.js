process.env.JWT_SECRET = "test-secret";

const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../src/app");
const { sequelize, User } = require("../src/models");

const validPayload = () => ({
  firstname: "Maria",
  surname: "Silva",
  email: "maria@example.com",
  password: "123@123",
  confirmPassword: "123@123",
});

const token = () => jwt.sign({ id: 1 }, process.env.JWT_SECRET);
const authHeader = () => ({ Authorization: `Bearer ${token()}` });

async function createUser(overrides = {}) {
  const res = await request(app)
    .post("/v1/user")
    .send({ ...validPayload(), ...overrides });
  return res.body;
}

beforeAll(async () => {
  await sequelize.sync({ force: true });
});

afterEach(async () => {
  await User.destroy({ where: {} });
});

afterAll(async () => {
  await sequelize.close();
});

describe("GET /v1/user/:id", () => {
  it("retorna 200 com os dados do usuário, sem a senha", async () => {
    const created = await createUser();
    const res = await request(app).get(`/v1/user/${created.id}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      id: created.id,
      firstname: "Maria",
      surname: "Silva",
      email: "maria@example.com",
    });
  });

  it("retorna 404 quando o usuário não existe", async () => {
    const res = await request(app).get("/v1/user/9999");
    expect(res.status).toBe(404);
  });

  it("retorna 404 quando o id não é numérico", async () => {
    const res = await request(app).get("/v1/user/abc");
    expect(res.status).toBe(404);
  });
});

describe("POST /v1/user", () => {
  it("retorna 201 e salva a senha com hash", async () => {
    const res = await request(app).post("/v1/user").send(validPayload());

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.password).toBeUndefined();

    const saved = await User.findByPk(res.body.id);
    expect(saved.password).not.toBe("123@123");
    expect(await saved.checkPassword("123@123")).toBe(true);
  });

  it.each(["firstname", "surname", "email", "password", "confirmPassword"])(
    "retorna 400 quando %s não é enviado",
    async (field) => {
      const payload = validPayload();
      delete payload[field];
      const res = await request(app).post("/v1/user").send(payload);
      expect(res.status).toBe(400);
    },
  );

  it("retorna 400 quando as senhas não coincidem", async () => {
    const res = await request(app)
      .post("/v1/user")
      .send({ ...validPayload(), confirmPassword: "outra" });
    expect(res.status).toBe(400);
  });

  it("retorna 400 quando o email é inválido", async () => {
    const res = await request(app)
      .post("/v1/user")
      .send({ ...validPayload(), email: "nao-e-email" });
    expect(res.status).toBe(400);
  });

  it("retorna 400 quando o email já está cadastrado", async () => {
    await createUser();
    const res = await request(app).post("/v1/user").send(validPayload());
    expect(res.status).toBe(400);
  });

  it("retorna 400 quando o JSON é inválido", async () => {
    const res = await request(app)
      .post("/v1/user")
      .set("Content-Type", "application/json")
      .send("{ invalido");
    expect(res.status).toBe(400);
  });
});

describe("PUT /v1/user/:id", () => {
  const update = {
    firstname: "Ana",
    surname: "Souza",
    email: "ana@example.com",
  };

  it("retorna 204 sem corpo e atualiza o usuário", async () => {
    const created = await createUser();
    const res = await request(app)
      .put(`/v1/user/${created.id}`)
      .set(authHeader())
      .send(update);

    expect(res.status).toBe(204);
    expect(res.body).toEqual({});
    expect(res.text).toBe("");

    const saved = await User.findByPk(created.id);
    expect(saved.firstname).toBe("Ana");
    expect(saved.email).toBe("ana@example.com");
  });

  it("não altera a senha", async () => {
    const created = await createUser();
    await request(app)
      .put(`/v1/user/${created.id}`)
      .set(authHeader())
      .send(update);

    const saved = await User.findByPk(created.id);
    expect(await saved.checkPassword("123@123")).toBe(true);
  });

  it("retorna 401 sem token", async () => {
    const created = await createUser();
    const res = await request(app).put(`/v1/user/${created.id}`).send(update);
    expect(res.status).toBe(401);
  });

  it("retorna 401 com token inválido", async () => {
    const created = await createUser();
    const res = await request(app)
      .put(`/v1/user/${created.id}`)
      .set("Authorization", "Bearer token-invalido")
      .send(update);
    expect(res.status).toBe(401);
  });

  it("retorna 404 quando o usuário não existe", async () => {
    const res = await request(app)
      .put("/v1/user/9999")
      .set(authHeader())
      .send(update);
    expect(res.status).toBe(404);
  });

  it.each(["firstname", "surname", "email"])(
    "retorna 400 quando %s não é enviado",
    async (field) => {
      const created = await createUser();
      const payload = { ...update };
      delete payload[field];
      const res = await request(app)
        .put(`/v1/user/${created.id}`)
        .set(authHeader())
        .send(payload);
      expect(res.status).toBe(400);
    },
  );

  it("retorna 400 quando o email já pertence a outro usuário", async () => {
    await createUser({ email: "outro@example.com" });
    const created = await createUser();
    const res = await request(app)
      .put(`/v1/user/${created.id}`)
      .set(authHeader())
      .send({ ...update, email: "outro@example.com" });
    expect(res.status).toBe(400);
  });
});

describe("DELETE /v1/user/:id", () => {
  it("retorna 204 sem corpo e remove o usuário", async () => {
    const created = await createUser();
    const res = await request(app)
      .delete(`/v1/user/${created.id}`)
      .set(authHeader());

    expect(res.status).toBe(204);
    expect(res.text).toBe("");
    expect(await User.findByPk(created.id)).toBeNull();
  });

  it("retorna 401 sem token", async () => {
    const created = await createUser();
    const res = await request(app).delete(`/v1/user/${created.id}`);
    expect(res.status).toBe(401);
    expect(await User.findByPk(created.id)).not.toBeNull();
  });

  it("retorna 404 quando o usuário não existe", async () => {
    const res = await request(app).delete("/v1/user/9999").set(authHeader());
    expect(res.status).toBe(404);
  });
});
