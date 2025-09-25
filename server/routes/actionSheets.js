const express = require("express");
const router = express.Router();
const controller = require("../controllers/actionsheetsController");

router.post("/", controller.addSheet);
router.get("/:userId", controller.getSheetsByUser);

module.exports = router;
