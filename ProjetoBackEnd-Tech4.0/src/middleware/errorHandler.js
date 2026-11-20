// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // Erro de negócio com status definido (AppError).
  if (err.status && err.status < 500) {
    return res.status(err.status).json({ message: err.message });
  }

  // JSON malformado no corpo da requisição.
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ message: "JSON inválido" });
  }

  console.error(err);
  return res.status(500).json({ message: "Erro interno do servidor" });
}

module.exports = errorHandler;
