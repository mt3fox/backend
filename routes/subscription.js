const express = require("express");
const router = express.Router();
const authenticate = require("../middleware/auth");
const subscriptionController = require("../controllers/subscription");

router.get(
  "/subscription-status/:userId",
  authenticate,
  subscriptionController.subscribe
);
router.get(
  "/auto-send-invoice-status/:userId",
  authenticate,
  subscriptionController.fetchAutoSendInvoiceStatus
);
router.put(
  "/auto-send-invoice-status/:userId",
  authenticate,
  subscriptionController.updateAutoSendInvoiceStatus
);
router.get(
  "/webhook-status/:userId",
  authenticate,
  subscriptionController.checkWebhookStatus
);

router.get(
  "/subscription-amount/:userId",
  subscriptionController.getsubscriptionAmount
);

module.exports = router;
