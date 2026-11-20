const bcrypt = require("bcrypt");
const { sequelize, User } = require("../src/models");

const validUser = {
  firstname: "Maria",
  surname: "Silva",
  email: "maria@example.com",
  password: "senha123",
};

beforeAll(async () => {
  await sequelize.sync({ force: true });
});

afterEach(async () => {
  await User.destroy({ where: {} });
});

afterAll(async () => {
  await sequelize.close();
});

describe("Model User", () => {
  it("cria a tabela com as colunas esperadas", async () => {
    const columns = Object.keys(User.rawAttributes);
    expect(columns).toEqual(
      expect.arrayContaining([
        "id",
        "firstname",
        "surname",
        "email",
        "password",
      ]),
    );
    expect(User.rawAttributes.id.autoIncrement).toBe(true);
    expect(User.rawAttributes.id.primaryKey).toBe(true);
  });

  it("preenche created_at e updated_at", async () => {
    const user = await User.create(validUser);
    expect(user.created_at).toBeInstanceOf(Date);
    expect(user.updated_at).toBeInstanceOf(Date);
  });

  it("incrementa o id automaticamente", async () => {
    const a = await User.create(validUser);
    const b = await User.create({ ...validUser, email: "outro@example.com" });
    expect(b.id).toBe(a.id + 1);
  });

  it.each(["firstname", "surname", "email", "password"])(
    "exige o campo %s",
    async (field) => {
      const data = { ...validUser };
      delete data[field];
      await expect(User.create(data)).rejects.toThrow();
    },
  );

  it("armazena o hash bcrypt da senha, não o texto puro", async () => {
    const user = await User.create(validUser);
    expect(user.password).not.toBe(validUser.password);
    expect(await bcrypt.compare(validUser.password, user.password)).toBe(true);
  });

  it("checkPassword valida a senha correta e rejeita a errada", async () => {
    const user = await User.create(validUser);
    expect(await user.checkPassword("senha123")).toBe(true);
    expect(await user.checkPassword("errada")).toBe(false);
  });
});
