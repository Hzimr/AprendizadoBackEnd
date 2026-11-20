const express = require("express");
const userRoutes = require("./routes/userRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const productRoutes = require("./routes/productRoutes");
const errorHandler = require("./middleware/errorHandler");

const app = express();

// O parser "simple" mantém chaves como option[45] literais. O parser padrão
// (qs) transformaria option[5]=GG em um array e perderia o id da opção.
app.set("query parser", "simple");

app.use(express.json());

app.use("/v1/user", userRoutes);
app.use("/v1/category", categoryRoutes);
app.use("/v1/product", productRoutes);

app.use(errorHandler);

module.exports = app;
