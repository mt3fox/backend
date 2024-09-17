const express = require("express");
const companyToController = require("../controllers/companyTo");

const router = express.Router();
const authenticate = require("../middleware/auth");

router.post(
  "/company-to-write/:id",
  authenticate,
  companyToController.writeDetails
);

router.get(
  "/company-to-get/:id",
  authenticate,
  companyToController.getAllDetails
);

router.put(
  "/company-to-update/:id",
  authenticate,
  companyToController.updateDetails
);

router.delete(
  "/company-to-delete/:id",
  authenticate,
  companyToController.deleteDetails
);

module.exports = router;
