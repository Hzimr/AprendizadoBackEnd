const express = require("express");
const userRoutes = require("./routes/userRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const errorHandler = require("./middleware/errorHandler");

const app = express();

app.use(express.json());

app.use("/v1/user", userRoutes);
app.use("/v1/category", categoryRoutes);

app.use(errorHandler);

module.exports = app;
