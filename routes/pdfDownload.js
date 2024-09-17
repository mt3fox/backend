const express = require("express");
const router = express.Router();
const pdfDownloadController = require("../controllers/pdfdownload");
const csvDownloadController = require("../controllers/csvdownload");
const authenticate = require("../middleware/auth");

router.get(
  "/invoices/download/:id",
  authenticate,
  pdfDownloadController.downloadInvoice
);
router.get(
  "/invoices/downloadcsv/:id",
  authenticate,
  csvDownloadController.generatecsv
);
router.get(
  "/invoices/downloadallcsv/:userId",
  authenticate,
  csvDownloadController.downloadallcsv
);

module.exports = router;
