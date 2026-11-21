const jwt = require("jsonwebtoken");

// Exige o header "Authorization: Bearer <jwt>".
//  - header ausente ou fora do formato "Bearer <token>"  => 400 Bad Request
//  - token com assinatura inválida, adulterado ou expirado => 401 Unauthorized
function auth(req, res, next) {
  const header = req.headers.authorization;
  const [scheme, token, ...extra] = (header || "").trim().split(/\s+/);

  if (
    !header ||
    scheme.toLowerCase() !== "bearer" ||
    !token ||
    extra.length > 0
  ) {
    return res.status(400).json({
      message: 'Informe o cabeçalho Authorization no formato "Bearer <token>"',
    });
  }

  try {
    req.auth = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ["HS256"],
    });
    return next();
  } catch (error) {
    return res.status(401).json({ message: "Token inválido ou expirado" });
  }
}

module.exports = auth;
