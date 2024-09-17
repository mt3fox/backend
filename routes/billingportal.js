const express = require("express");
const router = express.Router();
const authenticate = require("../middleware/auth");

const billingPortal = require("../controllers/billingPortal");

router.post(
  "/stripe/billing-portal",
  authenticate,
  billingPortal.createCustomer
);



module.exports = router;
