const express = require("express");
const userRoutes = require("./routes/userRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const productRoutes = require("./routes/productRoutes");
const errorHandler = require("./middleware/errorHandler");
const { getMediaDir } = require("./config/media");

const app = express();

// O parser "simple" mantém chaves como option[45] literais. O parser padrão
// (qs) transformaria option[5]=GG em um array e perderia o id da opção.
app.set("query parser", "simple");

// Imagens chegam em base64 no JSON, então o limite padrão (100 KB) não basta.
app.use(express.json({ limit: "20mb" }));

// Serve as imagens salvas: o campo "content" de uma imagem é o caminho
// relativo a /media (ex.: /media/products/1/abc.png).
app.use("/media", express.static(getMediaDir()));

app.use("/v1/user", userRoutes);
app.use("/v1/category", categoryRoutes);
app.use("/v1/product", productRoutes);

app.use(errorHandler);

module.exports = app;
