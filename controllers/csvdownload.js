const { supabase } = require("../config/config");

const { stringify } = require("csv-stringify/sync");

const fieldNameMapping = {
  invoice_number: "Invoice Number",
  date_of_issue: "Date of Issue",
  date_due: "Date Due",
  bill_from: "Bill From",
  bill_from_address_line_1: "Bill From Address Line 1",
  bill_from_address_line_2: "Bill From Address Line 2",
  bill_from_city: "Bill From City",
  bill_from_state: "Bill From State",
  bill_from_postal_code: "Bill From Postal Code",
  bill_from_country: "Bill From Country",
  bill_from_email: "Bill From Email",
  bill_from_phone: "Bill From Phone",
  bill_to: "Bill To",
  bill_to_address_line_1: "Bill To Address Line 1",
  bill_to_address_line_2: "Bill To Address Line 2",
  bill_to_city: "Bill To City",
  bill_to_state: "Bill To State",
  bill_to_postal_code: "Bill To Postal Code",
  bill_to_country: "Bill To Country",
  bill_to_email: "Bill To Email",
  bill_to_phone: "Bill To Phone",
  subtotal: "Subtotal",
  discount: "Discount",
  total: "Total",
  amount_due: "Amount Due",
  is_stripe_charge: "Stripe Invoice?",
  currency: "Currency",
  thankyou_note: "Thank You Note",
  // New fields for items
  items: "Items",
  "items.description": "Item Description",
  "items.quantity": "Item Quantity",
  "items.unit_price": "Item Unit Price",
  "items.subtotal": "Item Subtotal",
};

const orderedFields = [
  "invoice_number",
  "date_of_issue",
  "date_due",
  "bill_from",
  "bill_from_address_line_1",
  "bill_from_address_line_2",
  "bill_from_city",
  "bill_from_state",
  "bill_from_postal_code",
  "bill_from_country",
  "bill_from_email",
  "bill_from_phone",
  "bill_to",
  "bill_to_address_line_1",
  "bill_to_address_line_2",
  "bill_to_city",
  "bill_to_state",
  "bill_to_postal_code",
  "bill_to_country",
  "bill_to_email",
  "bill_to_phone",
  "items",
  "subtotal",
  "discount",
  "total",
  "amount_due",
  "is_stripe_charge",
  "currency",
  "thankyou_note",
];

const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const formatPhoneNumber = (number) => {
  const phoneNumber = Number(number).toString();
  return phoneNumber.replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3");
};

const csvDownloadController = {
  generatecsv: async (req, res) => {
    try {
      const id = req.params.id;

      const { data: invoice, error } = await supabase
        .from("demoinvoices")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      if (!invoice) return res.status(404).json({ error: "Invoice not found" });

      console.log(JSON.stringify(invoice, null, 2));

      // Create CSV data
      const csvData = [
        ["Field", "Value"], // CSV header
      ];

      // Add main invoice fields
      orderedFields.forEach((key) => {
        if (key === "items") {
          // Handle items separately
          if (Array.isArray(invoice[key]) && invoice[key].length > 0) {
            invoice[key].forEach((item, index) => {
              csvData.push([`Item ${index + 1}`, ""]);
              csvData.push([
                fieldNameMapping["items.description"],
                item.description || "",
              ]);
              csvData.push([
                fieldNameMapping["items.quantity"],
                item.quantity?.toString() || "",
              ]);
              csvData.push([
                fieldNameMapping["items.unit_price"],
                item.unit_price?.toString() || "",
              ]);
              csvData.push([
                fieldNameMapping["items.subtotal"],
                item.subtotal?.toString() || "",
              ]);
            });
          } else {
            csvData.push([fieldNameMapping[key], "No items"]);
          }
        } else {
          let value = invoice[key];
          if (value !== null && value !== undefined) {
            if (key === "date_of_issue" || key === "date_due") {
              value = formatDate(value);
            } else if (key === "bill_from_phone" || key === "bill_to_phone") {
              value = formatPhoneNumber(value);
            } else if (typeof value === "boolean") {
              value = value ? "Yes" : "No";
            } else if (typeof value === "number") {
              value = value.toString();
            }
            csvData.push([fieldNameMapping[key] || key, value]);
          }
        }
      });

      const csvString = stringify(csvData);

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=${invoice.invoice_number}.csv`
      );

      res.send(csvString);
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ message: "Error downloading csv", error: error.message });
    }
  },
  downloadallcsv: async (req, res) => {
    try {
      const userId = req.params.userId;
      const { data: invoices, error } = await supabase
        .from("demoinvoices")
        .select("*")
        .eq("user_id", userId);

      if (error) throw error;
      if (!invoices || invoices.length === 0)
        return res.status(404).json({ error: "No invoices found" });

      console.log(JSON.stringify(invoices, null, 2));

      const csvData = [
        ["Invoice Number", "Field", "Value"], // CSV header
      ];

      invoices.forEach((invoice, invoiceIndex) => {
        let isFirstRow = true;

        orderedFields.forEach((key) => {
          if (key === "items") {
            // Handle items separately
            if (Array.isArray(invoice[key]) && invoice[key].length > 0) {
              invoice[key].forEach((item, itemIndex) => {
                csvData.push([
                  isFirstRow ? invoice.invoice_number : "",
                  `Item ${itemIndex + 1}`,
                  "",
                ]);
                isFirstRow = false;
                csvData.push([
                  "",
                  fieldNameMapping["items.description"],
                  item.description || "",
                ]);
                csvData.push([
                  "",
                  fieldNameMapping["items.quantity"],
                  item.quantity?.toString() || "",
                ]);
                csvData.push([
                  "",
                  fieldNameMapping["items.unit_price"],
                  item.unit_price?.toString() || "",
                ]);
                csvData.push([
                  "",
                  fieldNameMapping["items.subtotal"],
                  item.subtotal?.toString() || "",
                ]);
              });
            } else {
              csvData.push([
                isFirstRow ? invoice.invoice_number : "",
                fieldNameMapping[key],
                "No items",
              ]);
              isFirstRow = false;
            }
          } else if (invoice[key] !== null && invoice[key] !== undefined) {
            let value = invoice[key];
            if (key === "date_of_issue" || key === "date_due") {
              value = formatDate(value);
            } else if (key === "bill_from_phone" || key === "bill_to_phone") {
              value = formatPhoneNumber(value);
            } else if (typeof value === "boolean") {
              value = value ? "Yes" : "No";
            } else if (typeof value === "number") {
              value = value.toString();
            }

            csvData.push([
              isFirstRow ? invoice.invoice_number : "",
              fieldNameMapping[key] || key,
              value.toString(),
            ]);
            isFirstRow = false;
          }
        });

        // Add two empty rows after each invoice, except for the last one
        if (invoiceIndex < invoices.length - 1) {
          csvData.push([], []);
        }
      });

      const csvString = stringify(csvData);

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=Pineapple-All-Invoices.csv`
      );

      res.send(csvString);
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ message: "Error downloading csv", error: error.message });
    }
  },
};

module.exports = csvDownloadController;
