const path = require("path");

// Pasta onde as imagens dos produtos são salvas. Pode ser trocada com a
// variável MEDIA_DIR no .env. Lida a cada chamada para facilitar os testes.
function getMediaDir() {
  return process.env.MEDIA_DIR
    ? path.resolve(process.env.MEDIA_DIR)
    : path.resolve(__dirname, "../../media");
}

module.exports = { getMediaDir };
