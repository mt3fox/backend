const express = require("express");
const router = express.Router();
const authenticate = require("../middleware/auth");
const mailController = require("../controllers/notification");

router.post(
  "/send/filtered-invoice",
  authenticate,
  mailController.filteredInvoicessend
);
router.post(
  "/send/invoice/:id",
  authenticate,
  mailController.sendInvoiceManual
);
router.post("/send/all-invoices", authenticate, mailController.sendAllInvoices);

module.exports = router;
