const express = require("express");
const router = express.Router();

const webhookbackend = require("../controllers/webhookbackend");

router.post(
  "/webhookUS",
  express.raw({ type: "application/json" }),
  webhookbackend.handleWebhooks
);

module.exports = router;
