const express = require("express");
const statsController = require("../controllers/stats");
const authenticate = require("../middleware/auth");
const router = express.Router();

router.get(
  "/email-sent-manual/:userId",
  authenticate,
  statsController.getEmailSentManualStats
);
router.get(
  "/email-sent-stripe/:userId",
  authenticate,
  statsController.getEmailSentStripeStats
);
router.get(
  "/saved-from-addresses/:userId",
  authenticate,
  statsController.getSavedFromAdressesStats
);
router.get(
  "/saved-to-addresses/:userId",
  authenticate,
  statsController.getSavedToAdressesStats
);

router.get(
  "/manual-invoice-stats/:userId",
  authenticate,
  statsController.getManualInvoicesStats
);
router.get(
  "/stripe-invoice-stats/:userId",
  authenticate,
  statsController.getStripeInvoicesStats
);

router.post(
  "/set-download-stats/:userId",
  authenticate,
  statsController.setInvoiceDownloadStats
);

router.get(
  "/get-download-stats/:userId",
  authenticate,
  statsController.getDownloadStats
);

router.get(
  "/get-paid-stats/:userId",
  authenticate,
  statsController.getpaidstats
);

router.get("/get-edited-stats/:userId", authenticate, statsController.isEdited);

router.get(
  "/get-delete-stats/:userId",
  authenticate,
  statsController.deleteCount
);

module.exports = router;
