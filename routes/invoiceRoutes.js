const express = require("express");
const invoiceController = require("../controllers/invoice");
const authenticate = require("../middleware/auth");

const router = express.Router();

// Get all invoices
router.get("/invoices/:userId", authenticate, invoiceController.getAllInvoices);

// Create a new invoice
router.post("/new-invoice", authenticate, invoiceController.createInvoice);

// Get a single invoice by ID
router.get("/invoices/:id", authenticate, invoiceController.getInvoiceById);

// Update an invoice
router.put("/invoices/:id", authenticate, invoiceController.updateInvoice);

// Delete an invoice
router.delete("/invoices/:id", authenticate, invoiceController.deleteInvoice);

router.patch(
  "/invoices/mark-as-paid/:id",
  authenticate,
  invoiceController.markInvoiceAsPaid
);

module.exports = router;
