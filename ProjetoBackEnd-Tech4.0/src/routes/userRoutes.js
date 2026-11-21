const { Router } = require("express");
const userController = require("../controllers/userController");
const auth = require("../middleware/auth");

const router = Router();

// Rotas públicas (precisam ser, senão ninguém conseguiria criar conta nem
// obter o primeiro token): cadastro e geração do token.
router.post("/", userController.create);
router.post("/token", userController.token);

router.get("/:id", userController.getById);
router.put("/:id", auth, userController.update);
router.delete("/:id", auth, userController.remove);

module.exports = router;
