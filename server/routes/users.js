const express = require("express");
const router = express.Router();
const usersController = require("../controllers/usersController");

router.post("/", usersController.createUser);
router.get("/", usersController.getUsers);
router.get("/:id", usersController.getUserById);
router.delete("/:id", usersController.deleteUser);
router.post("/verify-key", usersController.verifyUserKey);
router.post("/deactivate", usersController.deactivateUser);

module.exports = router;
