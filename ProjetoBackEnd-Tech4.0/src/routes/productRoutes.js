const { Router } = require("express");
const productController = require("../controllers/productController");

const router = Router();

router.get("/search", productController.search);

module.exports = router;
