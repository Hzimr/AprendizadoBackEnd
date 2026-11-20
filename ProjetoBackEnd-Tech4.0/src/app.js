const express = require("express");
const userRoutes = require("./routes/userRoutes");
const errorHandler = require("./middleware/errorHandler");

const app = express();

app.use(express.json());

app.use("/v1/user", userRoutes);

app.use(errorHandler);

module.exports = app;
