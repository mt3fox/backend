const express = require("express");
const router = express.Router();
const stripeValidate = require("../controllers/stripeValidate");
const authenticate = require("../middleware/auth");

router.post("/user-validate", authenticate, stripeValidate.validate);
router.put("/edit-details-validate/:userId", authenticate, stripeValidate.edit);
router.get(
  "/get-details-validate/:userId",
  authenticate,
  stripeValidate.getDetails
);

module.exports = router;
