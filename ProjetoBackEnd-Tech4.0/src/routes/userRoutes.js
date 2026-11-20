const { Router } = require("express");
const userController = require("../controllers/userController");
const auth = require("../middleware/auth");

const router = Router();

router.get("/:id", userController.getById);
router.post("/", userController.create);
router.put("/:id", auth, userController.update);
router.delete("/:id", auth, userController.remove);

module.exports = router;
