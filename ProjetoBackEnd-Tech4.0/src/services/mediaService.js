const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const AppError = require("./AppError");
const { getMediaDir } = require("../config/media");

const IMAGE_TYPES = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
};
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB por imagem
const BASE64_REGEX = /^[A-Za-z0-9+/]+={0,2}$/;

// "image/png" => "png". Retorna undefined para tipos não aceitos.
function extensionForType(type) {
  return typeof type === "string"
    ? IMAGE_TYPES[type.trim().toLowerCase()]
    : undefined;
}

function extensionOf(relativePath) {
  return path.extname(relativePath).replace(".", "");
}

// Remove o prefixo "data:image/png;base64," (se houver) e espaços/quebras de linha.
function cleanBase64(content) {
  return content.replace(/^data:[^;,]+;base64,/i, "").replace(/\s+/g, "");
}

function looksLikeBase64(content) {
  if (typeof content !== "string") return false;
  const clean = cleanBase64(content);
  return clean.length > 0 && clean.length % 4 === 0 && BASE64_REGEX.test(clean);
}

function decodeBase64Image(content, label) {
  if (!looksLikeBase64(content)) {
    throw new AppError(400, `${label}.content deve estar em base64`);
  }
  const buffer = Buffer.from(cleanBase64(content), "base64");
  if (buffer.length === 0) {
    throw new AppError(400, `${label}.content está vazio`);
  }
  if (buffer.length > MAX_IMAGE_BYTES) {
    throw new AppError(400, `${label}.content excede o limite de 5 MB`);
  }
  return buffer;
}

// Caminho relativo salvo no banco, ex.: products/12/6f1c...e2.png
function newImagePath(productId, extension) {
  return path.posix.join(
    "products",
    String(productId),
    `${crypto.randomUUID()}.${extension}`,
  );
}

// Converte o caminho relativo em absoluto, garantindo que fica dentro da pasta de mídia.
function resolveInsideMedia(relativePath) {
  const root = getMediaDir();
  const full = path.resolve(root, relativePath);
  return full.startsWith(root + path.sep) ? full : null;
}

async function writeImage(relativePath, buffer) {
  const full = resolveInsideMedia(relativePath);
  if (!full) {
    throw new Error(`Caminho de imagem inválido: ${relativePath}`);
  }
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, buffer);
}

// Apaga arquivos (e a pasta do produto, se ficar vazia). Nunca lança erro:
// uma imagem que já não existe em disco não deve impedir a operação.
async function removeImages(relativePaths = []) {
  for (const relativePath of relativePaths) {
    const full = resolveInsideMedia(relativePath);
    if (full) {
      try {
        await fs.unlink(full);
      } catch (error) {
        // arquivo já removido ou inexistente
      }
      try {
        await fs.rmdir(path.dirname(full)); // só remove se estiver vazia
      } catch (error) {
        // pasta com outros arquivos
      }
    }
  }
}

module.exports = {
  extensionForType,
  extensionOf,
  looksLikeBase64,
  decodeBase64Image,
  newImagePath,
  writeImage,
  removeImages,
};
