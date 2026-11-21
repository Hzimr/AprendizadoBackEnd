# API de E-commerce (Node.js + Express + Sequelize)

API REST para gerenciar **usuários**, **categorias** e **produtos** (com imagens, opções e categorias), protegida por **JWT**.

## Tecnologias

| Tecnologia                                                                   | Para que serve                                          |
| ---------------------------------------------------------------------------- | ------------------------------------------------------- |
| [Node.js](https://nodejs.org/)                                               | Executar JavaScript no servidor                         |
| [Express.js](https://expressjs.com/)                                         | Criar as rotas da API                                   |
| [Dotenv](https://github.com/motdotla/dotenv)                                 | Configurações por variáveis de ambiente                 |
| [Nodemon](https://nodemon.io/)                                               | Reiniciar o servidor automaticamente em desenvolvimento |
| [MySQL](https://www.mysql.com/)                                              | Persistência dos dados                                  |
| [Sequelize](https://sequelize.org/)                                          | ORM para acessar o banco                                |
| [JWT](https://jwt.io/) (`jsonwebtoken`)                                      | Autenticação e proteção das rotas                       |
| [bcrypt](https://github.com/kelektiv/node.bcrypt.js)                         | Hash das senhas                                         |
| [Jest](https://jestjs.io/) + [Supertest](https://github.com/ladjs/supertest) | Testes automatizados                                    |

## Requisitos

- Node.js 18 ou superior
- MySQL 8 (ou compatível) em execução

## Como executar

1. **Instale as dependências**

   ```bash
   npm install
   ```

2. **Crie o banco de dados** no MySQL (o Sequelize cria as tabelas, mas não o banco):

   ```sql
   CREATE DATABASE project_db;
   ```

3. **Configure o arquivo `.env`** na raiz do projeto:

   ```env
   PORT=3000

   DB_HOST=localhost
   DB_PORT=3306
   DB_NAME=project_db
   DB_USER=root
   DB_PASSWORD=sua_senha_do_mysql

   JWT_SECRET=troque-por-um-segredo-longo-e-aleatorio
   JWT_EXPIRES_IN=1h

   # Opcional: pasta onde as imagens dos produtos são salvas (padrão: ./media)
   # MEDIA_DIR=media
   ```

   > O `.env` está no `.gitignore`. Nunca publique o `JWT_SECRET` nem a senha do banco.

4. **Inicie o servidor**

   ```bash
   npm run dev     # desenvolvimento (nodemon)
   npm start       # produção
   ```

   Ao subir, o servidor conecta no banco, cria as tabelas que ainda não existem e informa a porta em que está rodando.

### Scripts

| Comando       | O que faz                     |
| ------------- | ----------------------------- |
| `npm run dev` | Inicia o servidor com nodemon |
| `npm start`   | Inicia o servidor com Node    |
| `npm test`    | Roda os testes com Jest       |

## Testes

```bash
npm test
```

Os testes usam **SQLite em memória** (o Jest define `NODE_ENV=test` sozinho), então **não precisam de MySQL** e não alteram o seu banco. As imagens dos testes são gravadas numa pasta temporária do sistema.

## Estrutura de pastas

```
project-root/
├── src/
│   ├── config/
│   │   ├── database.js          # conexão Sequelize (MySQL; SQLite nos testes)
│   │   └── media.js             # pasta onde as imagens são salvas
│   ├── controllers/             # recebem a requisição e devolvem a resposta
│   ├── middleware/
│   │   ├── auth.js              # valida o JWT
│   │   └── errorHandler.js      # converte erros em respostas JSON
│   ├── models/                  # User, Category, Product, ProductImage,
│   │                            # ProductOption, ProductCategory + associações
│   ├── routes/                  # rotas de /v1/user, /v1/category e /v1/product
│   ├── services/                # regras de negócio e validações
│   ├── app.js                   # configuração do Express
│   └── server.js                # conecta no banco e sobe o servidor
├── tests/                       # testes de models e de rotas
├── media/                       # imagens enviadas (criada automaticamente)
├── .env
├── .gitignore
└── package.json
```

## Banco de dados

Todas as tabelas têm `created_at` e `updated_at` (`timestamps: true`).

| Tabela               | Colunas principais                                                                                                                 |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `users`              | `id`, `firstname`, `surname`, `email`, `password` (hash bcrypt)                                                                    |
| `categories`         | `id`, `name`, `slug`, `use_in_menu` (padrão `0`)                                                                                   |
| `products`           | `id`, `enabled` (padrão `0`), `name`, `slug`, `use_in_menu`, `stock` (padrão `0`), `description`, `price`, `price_with_discount`   |
| `product_images`     | `id`, `product_id` (FK), `enabled` (padrão `0`), `path`                                                                            |
| `product_options`    | `id`, `product_id` (FK), `title`, `shape` (`square`/`circle`), `radius`, `type` (`text`/`color`), `values` (separados por vírgula) |
| `product_categories` | `product_id` (FK), `category_id` (FK)                                                                                              |

As chaves estrangeiras usam `ON DELETE CASCADE`.

## Autenticação

Os endpoints **POST, PUT e DELETE** exigem o cabeçalho:

```
Authorization: Bearer <jwt>
```

| Situação                                              | Status             |
| ----------------------------------------------------- | ------------------ |
| Cabeçalho ausente ou fora do formato `Bearer <token>` | `400 Bad Request`  |
| Token inválido, adulterado ou expirado                | `401 Unauthorized` |

Exceções públicas (não exigem token): `POST /v1/user` (cadastro) e `POST /v1/user/token` (geração do token). Todos os `GET` também são públicos.

**Fluxo básico:**

```bash
# 1. Cadastrar um usuário
curl -X POST http://localhost:3000/v1/user \
  -H "Content-Type: application/json" \
  -d '{"firstname":"Maria","surname":"Silva","email":"maria@mail.com","password":"123@123","confirmPassword":"123@123"}'

# 2. Gerar o token
curl -X POST http://localhost:3000/v1/user/token \
  -H "Content-Type: application/json" \
  -d '{"email":"maria@mail.com","password":"123@123"}'
# => { "token": "<JWT>" }

# 3. Usar o token em uma rota protegida
curl -X POST http://localhost:3000/v1/category \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <JWT>" \
  -d '{"name":"Shoes","slug":"shoes","use_in_menu":true}'
```

## Endpoints

### Usuários

| Método   | Rota             | Token | Respostas          |
| -------- | ---------------- | ----- | ------------------ |
| `GET`    | `/v1/user/:id`   | não   | 200, 404           |
| `POST`   | `/v1/user`       | não   | 201, 400           |
| `POST`   | `/v1/user/token` | não   | 200, 400           |
| `PUT`    | `/v1/user/:id`   | sim   | 204, 400, 401, 404 |
| `DELETE` | `/v1/user/:id`   | sim   | 204, 401, 404      |

### Categorias

| Método   | Rota                  | Token | Respostas          |
| -------- | --------------------- | ----- | ------------------ |
| `GET`    | `/v1/category/search` | não   | 200, 400           |
| `GET`    | `/v1/category/:id`    | não   | 200, 404           |
| `POST`   | `/v1/category`        | sim   | 201, 400, 401      |
| `PUT`    | `/v1/category/:id`    | sim   | 204, 400, 401, 404 |
| `DELETE` | `/v1/category/:id`    | sim   | 204, 401, 404      |

### Produtos

| Método   | Rota                 | Token | Respostas          |
| -------- | -------------------- | ----- | ------------------ |
| `GET`    | `/v1/product/search` | não   | 200, 400           |
| `GET`    | `/v1/product/:id`    | não   | 200, 404           |
| `POST`   | `/v1/product`        | sim   | 201, 400, 401      |
| `PUT`    | `/v1/product/:id`    | sim   | 204, 400, 401, 404 |
| `DELETE` | `/v1/product/:id`    | sim   | 204, 401, 404      |

> Nos endpoints protegidos, a ausência do cabeçalho `Authorization` retorna **400** (veja [Autenticação](#autenticação)).

## Busca

### `GET /v1/category/search`

| Parâmetro     | Descrição                                    | Padrão |
| ------------- | -------------------------------------------- | ------ |
| `limit`       | Itens por página. Use `-1` para buscar todos | `12`   |
| `page`        | Página (ignorada quando `limit=-1`)          | `1`    |
| `fields`      | Campos retornados, ex.: `name,slug`          | todos  |
| `use_in_menu` | `true` filtra as categorias do menu          | –      |

### `GET /v1/product/search`

| Parâmetro      | Descrição                                                                                                                                       | Exemplo                    |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| `limit`        | Itens por página. Use `-1` para buscar todos (padrão `12`)                                                                                      | `limit=30`                 |
| `page`         | Página (padrão `1`; ignorada com `limit=-1`)                                                                                                    | `page=2`                   |
| `fields`       | Campos retornados: `id`, `enabled`, `name`, `slug`, `stock`, `description`, `price`, `price_with_discount`, `category_ids`, `images`, `options` | `fields=name,images,price` |
| `match`        | Termo no nome ou na descrição (sem diferenciar maiúsculas)                                                                                      | `match=Tênis`              |
| `category_ids` | Produtos de qualquer uma das categorias                                                                                                         | `category_ids=15,24`       |
| `price-range`  | Faixa de preço (`price`), limites inclusivos                                                                                                    | `price-range=100-200`      |
| `option[<id>]` | Produtos cuja opção `<id>` tenha qualquer um dos valores                                                                                        | `option[45]=GG,PP`         |

Os filtros se combinam com **E** (o produto precisa passar por todos). Parâmetros inválidos retornam `400`.

A resposta segue o formato:

```json
{
  "data": [{ "id": 1, "name": "Produto 01", "...": "..." }],
  "total": 120,
  "limit": 12,
  "page": 1
}
```

## Produtos: cadastro e atualização

### Corpo do `POST /v1/product`

```json
{
  "enabled": true,
  "name": "Produto 01",
  "slug": "produto-01",
  "stock": 10,
  "description": "Descrição do produto 01",
  "price": 119.9,
  "price_with_discount": 99.9,
  "category_ids": [1, 15],
  "images": [{ "type": "image/png", "content": "<imagem em base64>" }],
  "options": [
    {
      "title": "Tamanho",
      "shape": "square",
      "radius": "4px",
      "type": "text",
      "values": ["P", "M", "G"]
    }
  ]
}
```

- **Obrigatórios:** `name`, `slug`, `price` e `price_with_discount` (o desconto pode ser `0`).
- **Opcionais:** `enabled` (padrão `false`), `stock` (padrão `0`), `description`, `category_ids`, `images` e `options`.
- As categorias informadas precisam existir; caso contrário, `400`.
- Textos aceitam até 255 caracteres.
- A resposta `201` traz o produto completo, no mesmo formato de `GET /v1/product/:id`.
- A criação é **atômica**: se algo falhar, nada é salvo (nem arquivos).

### Imagens

- Enviadas em **base64** (com ou sem o prefixo `data:...;base64,`). Tipos aceitos: `image/png`, `image/jpg`, `image/jpeg`, `image/gif` e `image/webp`, com até 5 MB cada.
- Os arquivos ficam em `media/` e o banco guarda o caminho relativo (ex.: `products/12/<uuid>.png`). O campo `content` retornado pela API é esse caminho, e a imagem pode ser aberta em `http://localhost:3000/media/<content>`.

### Atualização (`PUT /v1/product/:id`)

`name`, `slug`, `price` e `price_with_discount` são obrigatórios. Os demais campos, se omitidos, **mantêm o valor atual**.

- **`category_ids`**: substitui a lista inteira (`[]` remove todas).
- **`images`** (cada item):
  - sem `id`, com `type` + `content` (base64): adiciona uma imagem;
  - `{ "id": 2, "deleted": true }`: remove a imagem e o arquivo;
  - `{ "id": 3, "content": "<base64>" }`: troca o arquivo (se `type` não vier, mantém a extensão);
  - `{ "id": 1, "content": "<URL ou caminho atual>" }`: mantém a imagem como está;
  - `{ "id": 1, "enabled": true }`: altera só o campo `enabled`.
- **`options`** (cada item):
  - sem `id`: cria uma opção (`title` e `values` obrigatórios);
  - `{ "id": 1, "deleted": true }`: remove a opção;
  - `{ "id": 2, "radius": "10px", "values": ["42/43"] }`: atualiza só os campos enviados.
- Ids de imagem ou opção que não pertencem ao produto retornam `400`.
- Em `options`, o valor pode vir em `values` ou `value`, e o `radius` aceita número ou texto como `"4px"`.

## Padrão de respostas

| Código             | Quando                                                       |
| ------------------ | ------------------------------------------------------------ |
| `200 OK`           | Requisição bem-sucedida, com corpo de resposta               |
| `201 Created`      | Recurso criado                                               |
| `204 No Content`   | `PUT`/`DELETE` bem-sucedidos, sem corpo                      |
| `400 Bad Request`  | Dados incorretos (ou cabeçalho `Authorization` ausente)      |
| `401 Unauthorized` | Token inválido ou expirado                                   |
| `404 Not Found`    | Recurso inexistente (inclui ids que não são números válidos) |

Os erros retornam um JSON no formato `{ "message": "..." }`.

## Requisitos do projeto

O escopo completo do projeto, com todos os requisitos, está no README oficial:

https://github.com/digitalcollegebr/projeto-backend/blob/main/README.md
