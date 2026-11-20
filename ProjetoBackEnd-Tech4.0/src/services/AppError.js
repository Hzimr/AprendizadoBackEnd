// Erro com status HTTP, lançado pelos services e traduzido pelo error handler.
class AppError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "AppError";
    this.status = status;
  }
}

module.exports = AppError;
