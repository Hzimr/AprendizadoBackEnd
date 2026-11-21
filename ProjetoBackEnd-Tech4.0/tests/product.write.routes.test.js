process.env.JWT_SECRET = "test-secret";

const fs = require("fs");
const os = require("os");
const path = require("path");

// As imagens dos testes são gravadas numa pasta temporária.
const MEDIA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "product-media-"));
process.env.MEDIA_DIR = MEDIA_DIR;

const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../src/app");
const {
  sequelize,
  Category,
  Product,
  ProductCategory,
  ProductImage,
  ProductOption,
} = require("../src/models");

const b64 = (text) => Buffer.from(text).toString("base64");
const authHeader = () => ({
  Authorization: `Bearer ${jwt.sign({ id: 1 }, process.env.JWT_SECRET)}`,
});

const exists = (relative) => fs.existsSync(path.join(MEDIA_DIR, relative));
const readFile = (relative) =>
  fs.readFileSync(path.join(MEDIA_DIR, relative), "utf8");

const post = (body) =>
  request(app).post("/v1/product").set(authHeader()).send(body);
const put = (id, body) =>
  request(app).put(`/v1/product/${id}`).set(authHeader()).send(body);
const get = (id) => request(app).get(`/v1/product/${id}`);
const del = (id) => request(app).delete(`/v1/product/${id}`).set(authHeader());

const basePayload = (overrides = {}) => ({
  name: "Produto 01",
  slug: "produto-01",
  price: 119.9,
  price_with_discount: 99.9,
  ...overrides,
});

async function createProduct(overrides = {}) {
  const res = await post(basePayload(overrides));
  expect(res.status).toBe(201);
  return res.body;
}

async function clearAll() {
  await ProductCategory.destroy({ where: {} });
  await ProductImage.destroy({ where: {} });
  await ProductOption.destroy({ where: {} });
  await Product.destroy({ where: {} });
  await Category.destroy({ where: {} });
  fs.rmSync(path.join(MEDIA_DIR, "products"), { recursive: true, force: true });
}

beforeAll(async () => {
  await sequelize.sync({ force: true });
});

afterEach(async () => {
  await clearAll();
});

afterAll(async () => {
  await sequelize.close();
  fs.rmSync(MEDIA_DIR, { recursive: true, force: true });
});

// ---------------------------------------------------------------- POST

describe("POST /v1/product", () => {
  it("retorna 201 com o produto criado (imagens em disco, opções e categorias)", async () => {
    const c1 = await Category.create({ name: "Calçados", slug: "calcados" });
    const c2 = await Category.create({ name: "Ofertas", slug: "ofertas" });

    const res = await post({
      enabled: true,
      name: "Produto 01",
      slug: "produto-01",
      stock: 10,
      description: "Descrição do produto 01",
      price: 119.9,
      price_with_discount: 99.9,
      category_ids: [c2.id, c1.id],
      images: [
        { type: "image/png", content: b64("imagem 1") },
        { type: "image/png", content: b64("imagem 2") },
        { type: "image/jpg", content: b64("imagem 3") },
      ],
      options: [
        {
          title: "Cor",
          shape: "square",
          radius: "4px",
          type: "text",
          value: ["PP", "GG", "M"],
        },
        {
          title: "Tamanho",
          shape: "circle",
          type: "color",
          values: ["#000", "#333"],
        },
      ],
    });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      enabled: true,
      name: "Produto 01",
      slug: "produto-01",
      stock: 10,
      description: "Descrição do produto 01",
      price: 119.9,
      price_with_discount: 99.9,
      category_ids: [c1.id, c2.id].sort((a, b) => a - b),
    });

    const { images, options } = res.body;
    expect(images).toHaveLength(3);
    expect(images.map((image) => path.extname(image.content))).toEqual([
      ".png",
      ".png",
      ".jpg",
    ]);
    expect(readFile(images[0].content)).toBe("imagem 1");
    expect(readFile(images[1].content)).toBe("imagem 2");
    expect(readFile(images[2].content)).toBe("imagem 3");

    expect(options).toHaveLength(2);
    expect(options[0]).toMatchObject({
      title: "Cor",
      shape: "square",
      radius: 4,
      type: "text",
      values: ["PP", "GG", "M"],
    });
    expect(options[1]).toMatchObject({
      title: "Tamanho",
      shape: "circle",
      radius: 0,
      type: "color",
      values: ["#000", "#333"],
    });

    // O que foi salvo é o mesmo que o GET devolve.
    const saved = await get(res.body.id);
    expect(saved.body).toEqual(res.body);
  });

  it("aplica valores padrão quando só os campos obrigatórios são enviados", async () => {
    const res = await post(basePayload());

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      id: expect.any(Number),
      enabled: false,
      name: "Produto 01",
      slug: "produto-01",
      stock: 0,
      description: null,
      price: 119.9,
      price_with_discount: 99.9,
      category_ids: [],
      images: [],
      options: [],
    });
  });

  it("aceita price_with_discount igual a 0", async () => {
    const res = await post(basePayload({ price_with_discount: 0 }));
    expect(res.status).toBe(201);
    expect(res.body.price_with_discount).toBe(0);
  });

  it("serve as imagens salvas em /media", async () => {
    const created = await createProduct({
      images: [{ type: "image/png", content: b64("imagem") }],
    });

    const res = await request(app).get(`/media/${created.images[0].content}`);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch("image/png");
  });

  it.each([
    ["sem name", { name: undefined }],
    ["name vazio", { name: "   " }],
    ["sem slug", { slug: undefined }],
    ["sem price", { price: undefined }],
    ["price como texto", { price: "10" }],
    ["price negativo", { price: -1 }],
    ["sem price_with_discount", { price_with_discount: undefined }],
    ["stock negativo", { stock: -1 }],
    ["stock decimal", { stock: 1.5 }],
    ["enabled como texto", { enabled: "true" }],
    ["description muito longa", { description: "x".repeat(256) }],
    ["category_ids que não é lista", { category_ids: 1 }],
    ["category_ids com id inválido", { category_ids: [0] }],
    ["images que não é lista", { images: {} }],
    ["imagem sem type", { images: [{ content: b64("a") }] }],
    [
      "imagem com type inválido",
      { images: [{ type: "text/plain", content: b64("a") }] },
    ],
    [
      "imagem fora do base64",
      { images: [{ type: "image/png", content: "não é base64!" }] },
    ],
    [
      "imagem com id",
      { images: [{ id: 1, type: "image/png", content: b64("a") }] },
    ],
    ["opção sem title", { options: [{ values: ["a"] }] }],
    ["opção sem values", { options: [{ title: "Cor" }] }],
    [
      "opção com values que não é lista",
      { options: [{ title: "Cor", values: "a,b" }] },
    ],
    [
      "opção com shape inválido",
      { options: [{ title: "Cor", values: ["a"], shape: "triangle" }] },
    ],
    [
      "opção com type inválido",
      { options: [{ title: "Cor", values: ["a"], type: "number" }] },
    ],
    [
      "opção com radius inválido",
      { options: [{ title: "Cor", values: ["a"], radius: "abc" }] },
    ],
    [
      "opção com valor contendo vírgula",
      { options: [{ title: "Cor", values: ["a,b"] }] },
    ],
    ["opção com id", { options: [{ id: 1, title: "Cor", values: ["a"] }] }],
  ])("retorna 400: %s", async (_, patch) => {
    const res = await post({ ...basePayload(), ...patch });
    expect(res.status).toBe(400);
  });

  it("retorna 400 quando o corpo não é um objeto", async () => {
    const res = await post([]);
    expect(res.status).toBe(400);
  });

  it("retorna 400 quando o JSON é inválido", async () => {
    const res = await request(app)
      .post("/v1/product")
      .set(authHeader())
      .set("Content-Type", "application/json")
      .send("{ invalido");
    expect(res.status).toBe(400);
  });

  it("retorna 400 quando uma categoria não existe, sem salvar nada", async () => {
    const res = await post(
      basePayload({
        category_ids: [99999],
        images: [{ type: "image/png", content: b64("imagem") }],
      }),
    );

    expect(res.status).toBe(400);
    expect(await Product.count()).toBe(0);
    expect(await ProductImage.count()).toBe(0);
    expect(fs.existsSync(path.join(MEDIA_DIR, "products"))).toBe(false);
  });

  it("não salva produto nem arquivos quando uma opção é inválida", async () => {
    const res = await post(
      basePayload({
        images: [{ type: "image/png", content: b64("imagem") }],
        options: [{ title: "Cor" }],
      }),
    );

    expect(res.status).toBe(400);
    expect(await Product.count()).toBe(0);
    expect(fs.existsSync(path.join(MEDIA_DIR, "products"))).toBe(false);
  });

  it("retorna 401 sem token", async () => {
    const res = await request(app).post("/v1/product").send(basePayload());
    expect(res.status).toBe(400);
    expect(await Product.count()).toBe(0);
  });

  it("retorna 401 com token inválido", async () => {
    const res = await request(app)
      .post("/v1/product")
      .set("Authorization", "Bearer token-invalido")
      .send(basePayload());
    expect(res.status).toBe(401);
  });
});

// ----------------------------------------------------------------- PUT

describe("PUT /v1/product/:id", () => {
  it("retorna 204 sem corpo e atualiza os dados do produto", async () => {
    const created = await createProduct({ stock: 10, description: "antiga" });

    const res = await put(created.id, {
      enabled: true,
      name: "Produto 01 atualizado",
      slug: "produto-01-atualizado",
      stock: 20,
      description: "Descrição do produto 01 atualizado",
      price: 49.9,
      price_with_discount: 0,
    });

    expect(res.status).toBe(204);
    expect(res.text).toBe("");

    const saved = await get(created.id);
    expect(saved.body).toMatchObject({
      enabled: true,
      name: "Produto 01 atualizado",
      slug: "produto-01-atualizado",
      stock: 20,
      description: "Descrição do produto 01 atualizado",
      price: 49.9,
      price_with_discount: 0,
    });
  });

  it("mantém o que não foi enviado (campos opcionais, categorias, imagens e opções)", async () => {
    const category = await Category.create({
      name: "Calçados",
      slug: "calcados",
    });
    const created = await createProduct({
      enabled: true,
      stock: 10,
      description: "Descrição",
      category_ids: [category.id],
      images: [{ type: "image/png", content: b64("imagem") }],
      options: [{ title: "Cor", values: ["P", "M"] }],
    });

    const res = await put(created.id, basePayload({ name: "Outro nome" }));
    expect(res.status).toBe(204);

    const saved = await get(created.id);
    expect(saved.body).toEqual({ ...created, name: "Outro nome" });
    expect(exists(created.images[0].content)).toBe(true);
  });

  it("substitui as categorias do produto", async () => {
    const [c1, c2, c3] = await Promise.all(
      ["a", "b", "c"].map((slug) => Category.create({ name: slug, slug })),
    );
    const created = await createProduct({ category_ids: [c1.id, c2.id] });

    await put(created.id, basePayload({ category_ids: [c2.id, c3.id] }));
    expect((await get(created.id)).body.category_ids).toEqual(
      [c2.id, c3.id].sort((a, b) => a - b),
    );

    await put(created.id, basePayload({ category_ids: [] }));
    expect((await get(created.id)).body.category_ids).toEqual([]);
  });

  it("adiciona, remove, troca e mantém imagens", async () => {
    const created = await createProduct({
      images: [
        { type: "image/png", content: b64("imagem 1") },
        { type: "image/png", content: b64("imagem 2") },
        { type: "image/jpg", content: b64("imagem 3") },
      ],
    });
    const [i1, i2, i3] = created.images;

    const res = await put(
      created.id,
      basePayload({
        images: [
          { type: "image/png", content: b64("imagem nova") }, // nova
          { id: i2.id, deleted: true }, // removida
          { id: i3.id, content: b64("imagem 3 trocada") }, // arquivo trocado
          { id: i1.id, content: `https://store.com/media/${i1.content}` }, // mantida
        ],
      }),
    );
    expect(res.status).toBe(204);

    const { images } = (await get(created.id)).body;
    expect(images).toHaveLength(3);
    expect(images.map((image) => image.id)).toEqual([
      i1.id,
      i3.id,
      expect.any(Number),
    ]);
    expect(images[2].id).not.toBe(i2.id);

    // mantida: mesmo arquivo
    expect(images[0].content).toBe(i1.content);
    expect(readFile(i1.content)).toBe("imagem 1");

    // trocada: novo arquivo, mesma extensão, arquivo antigo apagado
    expect(images[1].content).not.toBe(i3.content);
    expect(path.extname(images[1].content)).toBe(".jpg");
    expect(readFile(images[1].content)).toBe("imagem 3 trocada");
    expect(exists(i3.content)).toBe(false);

    // nova
    expect(readFile(images[2].content)).toBe("imagem nova");

    // removida: arquivo apagado
    expect(exists(i2.content)).toBe(false);
  });

  it("aceita o caminho atual da imagem como content (sem trocar o arquivo)", async () => {
    const created = await createProduct({
      images: [{ type: "image/png", content: b64("imagem") }],
    });
    const [image] = created.images;

    const res = await put(
      created.id,
      basePayload({ images: [{ id: image.id, content: image.content }] }),
    );

    expect(res.status).toBe(204);
    expect((await get(created.id)).body.images).toEqual(created.images);
  });

  it("retorna 400 quando o content da imagem não é base64, URL nem o caminho atual", async () => {
    const created = await createProduct({
      images: [{ type: "image/png", content: b64("imagem") }],
    });

    const res = await put(
      created.id,
      basePayload({
        images: [{ id: created.images[0].id, content: "products/1/outro.png" }],
      }),
    );
    expect(res.status).toBe(400);
  });

  it("atualiza o campo enabled de uma imagem", async () => {
    const created = await createProduct({
      images: [{ type: "image/png", content: b64("imagem") }],
    });
    const imageId = created.images[0].id;

    await put(
      created.id,
      basePayload({ images: [{ id: imageId, enabled: true }] }),
    );

    expect((await ProductImage.findByPk(imageId)).enabled).toBe(true);
  });

  it("retorna 400 quando a imagem pertence a outro produto, sem alterar nada", async () => {
    const mine = await createProduct({ slug: "meu" });
    const other = await createProduct({
      slug: "outro",
      images: [{ type: "image/png", content: b64("imagem") }],
    });

    const res = await put(
      mine.id,
      basePayload({ images: [{ id: other.images[0].id, deleted: true }] }),
    );

    expect(res.status).toBe(400);
    expect(await ProductImage.count({ where: { product_id: other.id } })).toBe(
      1,
    );
    expect(exists(other.images[0].content)).toBe(true);
  });

  it("adiciona, remove e atualiza opções", async () => {
    const created = await createProduct({
      options: [
        { title: "Cor", values: ["vermelho", "azul"] },
        { title: "Tamanho", shape: "circle", values: ["P", "M"] },
      ],
    });
    const [o1, o2] = created.options;

    const res = await put(
      created.id,
      basePayload({
        options: [
          { id: o1.id, deleted: true },
          { id: o2.id, radius: "10px", value: ["42/43", "44/45"] },
          {
            title: "Tipo",
            shape: "square",
            type: "text",
            values: ["100% algodão", "65% algodão"],
          },
        ],
      }),
    );
    expect(res.status).toBe(204);

    const { options } = (await get(created.id)).body;
    expect(options).toHaveLength(2);
    expect(options[0]).toEqual({
      id: o2.id,
      title: "Tamanho", // não enviado: mantido
      shape: "circle", // não enviado: mantido
      radius: 10,
      type: "text",
      values: ["42/43", "44/45"],
    });
    expect(options[1]).toMatchObject({
      title: "Tipo",
      shape: "square",
      type: "text",
      values: ["100% algodão", "65% algodão"],
    });
    expect(options.map((option) => option.id)).not.toContain(o1.id);
  });

  it("retorna 400 quando a opção pertence a outro produto", async () => {
    const mine = await createProduct({ slug: "meu" });
    const other = await createProduct({
      slug: "outro",
      options: [{ title: "Cor", values: ["a"] }],
    });

    const res = await put(
      mine.id,
      basePayload({ options: [{ id: other.options[0].id, deleted: true }] }),
    );

    expect(res.status).toBe(400);
    expect(await ProductOption.count({ where: { product_id: other.id } })).toBe(
      1,
    );
  });

  it("retorna 404 quando o produto não existe", async () => {
    const res = await put(9999, basePayload());
    expect(res.status).toBe(404);
  });

  it("retorna 404 (antes de validar o corpo) quando o produto não existe", async () => {
    const res = await put(9999, { name: "" });
    expect(res.status).toBe(404);
  });

  it.each([
    ["sem name", { name: undefined }],
    ["sem slug", { slug: undefined }],
    ["sem price", { price: undefined }],
    ["sem price_with_discount", { price_with_discount: undefined }],
    ["price inválido", { price: "abc" }],
    ["stock inválido", { stock: -5 }],
    ["category_ids inválido", { category_ids: "x" }],
    ["imagem nova sem type", { images: [{ content: b64("a") }] }],
    ["opção nova sem values", { options: [{ title: "Cor" }] }],
    ["opção com shape inválido", { options: [{ id: 1, shape: "triangle" }] }],
    [
      "mesmo id repetido nas imagens",
      { images: [{ id: 1 }, { id: 1, deleted: true }] },
    ],
  ])("retorna 400: %s", async (_, patch) => {
    const created = await createProduct();
    const res = await put(created.id, { ...basePayload(), ...patch });
    expect(res.status).toBe(400);
  });

  it("retorna 400 quando uma categoria não existe, sem alterar o produto", async () => {
    const created = await createProduct();

    const res = await put(
      created.id,
      basePayload({ name: "Nome novo", category_ids: [99999] }),
    );

    expect(res.status).toBe(400);
    expect((await get(created.id)).body.name).toBe("Produto 01");
  });

  it("não altera nada quando uma opção é inválida", async () => {
    const created = await createProduct();

    const res = await put(
      created.id,
      basePayload({ name: "Nome novo", options: [{ title: "Cor" }] }),
    );

    expect(res.status).toBe(400);
    expect((await get(created.id)).body.name).toBe("Produto 01");
  });

  it("retorna 401 sem token", async () => {
    const created = await createProduct();
    const res = await request(app)
      .put(`/v1/product/${created.id}`)
      .send(basePayload({ name: "Nome novo" }));
    expect(res.status).toBe(400);
    expect((await get(created.id)).body.name).toBe("Produto 01");
  });

  it("retorna 401 com token inválido", async () => {
    const created = await createProduct();
    const res = await request(app)
      .put(`/v1/product/${created.id}`)
      .set("Authorization", "Bearer token-invalido")
      .send(basePayload());
    expect(res.status).toBe(401);
  });
});

// -------------------------------------------------------------- DELETE

describe("DELETE /v1/product/:id", () => {
  it("retorna 204 sem corpo e remove o produto, seus dados e os arquivos", async () => {
    const category = await Category.create({
      name: "Calçados",
      slug: "calcados",
    });
    const target = await createProduct({
      slug: "alvo",
      category_ids: [category.id],
      images: [
        { type: "image/png", content: b64("imagem 1") },
        { type: "image/jpg", content: b64("imagem 2") },
      ],
      options: [{ title: "Cor", values: ["a", "b"] }],
    });
    const other = await createProduct({
      slug: "outro",
      category_ids: [category.id],
      images: [{ type: "image/png", content: b64("imagem do outro") }],
      options: [{ title: "Tamanho", values: ["P"] }],
    });

    const res = await del(target.id);

    expect(res.status).toBe(204);
    expect(res.text).toBe("");
    expect((await get(target.id)).status).toBe(404);

    // dados relacionados do produto removido
    const where = { product_id: target.id };
    expect(await ProductImage.count({ where })).toBe(0);
    expect(await ProductOption.count({ where })).toBe(0);
    expect(await ProductCategory.count({ where })).toBe(0);
    target.images.forEach((image) => expect(exists(image.content)).toBe(false));
    expect(exists(`products/${target.id}`)).toBe(false);

    // o outro produto e a categoria continuam intactos
    expect((await get(other.id)).body).toEqual(other);
    expect(readFile(other.images[0].content)).toBe("imagem do outro");
    expect(await Category.count()).toBe(1);
  });

  it("retorna 401 sem token", async () => {
    const created = await createProduct();
    const res = await request(app).delete(`/v1/product/${created.id}`);
    expect(res.status).toBe(400);
    expect((await get(created.id)).status).toBe(200);
  });

  it("retorna 404 quando o produto não existe", async () => {
    const res = await del(9999);
    expect(res.status).toBe(404);
  });

  it("retorna 404 quando o id não é numérico", async () => {
    const res = await del("abc");
    expect(res.status).toBe(404);
  });
});
