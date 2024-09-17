const express = require("express");
const stripeDataController = require("../controllers/autogen");
const router = express.Router();
const authenticate = require("../middleware/auth");

// Fetch and store Stripe data
// Define the route for fetching and storing Stripe data
router.post(
  "/fetch-and-store-stripe-data",
  authenticate,
  stripeDataController.fetchAndStoreStripeData
);

router.put(
  "/edit-stripe/:invoiceId/:userId",
  authenticate,
  stripeDataController.editStripeInvoice
);
router.get(
  "/get-all-stripe-invoices/:userId",
  authenticate,
  stripeDataController.getAllStripeInvoices
);

// Delete a stripe invoice by charge id
router.delete(
  "/delete-stripe-invoice/:id",
  authenticate,
  stripeDataController.deleteStripeInvoice
);

// Check if an invoice is a stripe charge
router.get(
  "/check-invoice/:id",
  authenticate,
  stripeDataController.checkInvoice
);

module.exports = router;
