const { Router } = require("express");
const productController = require("../controllers/productController");

const router = Router();

// /search precisa vir antes de /:id, senão "search" seria tratado como um id.
router.get("/search", productController.search);
router.get("/:id", productController.getById);

module.exports = router;
