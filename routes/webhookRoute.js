const express = require("express");
const authenticate = require("../middleware/auth");
const { handleWebhook, activateWebhook } = require("../controllers/webhook");

const router = express.Router();

router.post("/activate-webhook/:userId", activateWebhook);
router.post(
  "/webhook/:userId",
  express.raw({ type: "application/json" }),
  handleWebhook
);

// remove authenticate if causes errors in webhook later

module.exports = router;
