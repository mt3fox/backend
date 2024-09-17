const express = require("express");
const companyController = require("../controllers/company");

const router = express.Router();
const authenticate = require("../middleware/auth");

router.post("/company-write/:id", authenticate, companyController.writeDetails);

router.get("/company-get/:id", authenticate, companyController.getAllDetails);

router.put(
  "/company-update/:id",
  authenticate,
  companyController.updateDetails
);

router.delete(
  "/company-delete/:id",
  authenticate,
  companyController.deleteDetails
);

router.put(
  "/company-details/set-default/:id",
  authenticate,
  companyController.setDefaultAddress
);

module.exports = router;
