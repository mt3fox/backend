const express = require("express");
const app = express();
const invoiceRoutes = require("./routes/invoiceRoutes");
const autogenRoutes = require("./routes/autogenRoutes");
const webhookRoute = require("./routes/webhookRoute");
const invoiceSend = require("./routes/invoiceSend");
const stripeValidate = require("./routes/stripeValidate");
const pdfDownload = require("./routes/pdfDownload");
const companyRoutes = require("./routes/company");
const CompanyToRoutes = require("./routes/companyTo");
const subscription = require("./routes/subscription");
const webhookbackend = require("./routes/webhookpaid");
const billingPortal = require("./routes/billingportal");
const statsRoutes = require("./routes/stats");
const errorHandler = require("./middleware/errorHandler");
const cors = require("cors");

const PORT = 4242;

// CORS setup
app.use(
  cors({
    origin: "*",
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    allowedHeaders: ["Content-Type", "Authorization"],
    exposedHeaders: ["Content-Disposition"],
  })
);

app.use("/api", webhookRoute); // dont parse the body here as we need raw data
app.use("/api", webhookbackend);

app.use(express.json()); // For parsing application/json
app.use(express.urlencoded({ extended: true })); // For parsing application/x-www-form-urlencoded

app.use("/api", invoiceSend);
app.use("/api", invoiceRoutes);
app.use("/api", autogenRoutes);
app.use("/api", stripeValidate);
app.use("/api", pdfDownload);
app.use("/api", companyRoutes);
app.use("/api", CompanyToRoutes);
app.use("/api", subscription);
app.use("/api", billingPortal);
app.use("/api", statsRoutes);

app.get("/", (req, res) => {
  return res.json({
    success: true,
    message: "Your server is up and running....",
  });
});

// Error handler
app.use(errorHandler);

// PORT setup
app.listen(PORT, () => {
  console.log(`App is running at ${PORT}`);
});
