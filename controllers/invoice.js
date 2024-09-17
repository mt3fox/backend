const { supabase } = require("../config/config");
const currencySymbols = require("../libs/currencySymbols");

const convertToUTC = (dateString) => {
  if (!dateString) return null;
  const date = new Date(dateString);
  return new Date(
    date.getTime() - date.getTimezoneOffset() * 60000
  ).toISOString();
};

const generateInvoiceNumber = async (user_id) => {
  if (!user_id) {
    throw new Error("User ID is required to generate an invoice number");
  }

  const { data, error } = await supabase
    .from("demoinvoices")
    .select("invoice_number")
    .eq("user_id", user_id)
    .order("invoice_number", { ascending: false })
    .limit(1);

  if (error) throw error;

  if (data.length === 0) return "INV-000001";

  const lastInvoiceNumber = data[0].invoice_number;
  const numericPart = parseInt(lastInvoiceNumber.split("-")[1]);
  const newNumericPart = (numericPart + 1).toString().padStart(6, "0");
  return `INV-${newNumericPart}`;
};

const invoiceController = {
  createInvoice: async (req, res) => {
    try {
      const user_id = req.user.id;
      const invoiceNumber = await generateInvoiceNumber(user_id);
      const { items, ...otherData } = req.body;

      if (!user_id) {
        return res.status(400).json({ message: "User ID is required" });
      }

      // Parse and format the items field
      const parsedItems = Array.isArray(items) ? items : JSON.parse(items);

      const numericFields = ["unit_price", "subtotal", "total", "amount_due"];
      const parsedData = {
        ...otherData,
        paidmanual: otherData.paidmanual,
        items: parsedItems,
      };
      const currency = parsedData.currency || "USD";
      const currencySymbol = currencySymbols[currency] || "$"; // Default to $ if symbol not found

      // Handle numeric fields as currency
      numericFields.forEach((field) => {
        if (parsedData[field] !== undefined && parsedData[field] !== null) {
          let numericValue;
          if (typeof parsedData[field] === "string") {
            numericValue = parsedData[field].replace(/[^\d.-]/g, "");
          } else {
            numericValue = parsedData[field];
          }
          const floatValue = parseFloat(numericValue);
          parsedData[field] = `${currencySymbol}${floatValue.toFixed(2)}`;
        }
      });

      // Handle discount as a percentage
      if (parsedData.discount !== undefined && parsedData.discount !== null) {
        let discountValue = parsedData.discount;
        if (typeof discountValue === "string") {
          discountValue = discountValue.replace(/[^\d.-]/g, ""); // Remove any non-numeric characters
        }
        const floatDiscount = parseFloat(discountValue);
        if (floatDiscount >= 0 && floatDiscount <= 100) {
          parsedData.discount = `${floatDiscount}%`; // Store the discount as a percentage
        } else {
          return res
            .status(400)
            .json({ message: "Discount must be between 0 and 100%" });
        }
      }

      // Convert date fields to UTC
      if (parsedData.date_of_issue) {
        parsedData.date_of_issue = convertToUTC(parsedData.date_of_issue);
      }
      if (parsedData.date_due) {
        parsedData.date_due = convertToUTC(parsedData.date_due);
      }

      const { data, error } = await supabase
        .from("demoinvoices")
        .insert({
          ...parsedData,
          user_id,
          invoice_number: invoiceNumber,
          is_stripe_charge: false,
        })
        .select();

      if (error) throw error;

      const createdInvoice = data[0];

      res.status(201).json({
        message: "Invoice created successfully",
        invoice: createdInvoice,
      });
    } catch (error) {
      console.error("Error creating invoice:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  },

  updateInvoice: async (req, res) => {
    try {
      const { id } = req.params;
      const { discount, total, amount_due, currency, paidmanual, items } =
        req.body;

      // Fetch the existing invoice
      const { data: existingInvoice, error: fetchError } = await supabase
        .from("demoinvoices")
        .select("*")
        .eq("id", id)
        .single();

      if (fetchError) throw fetchError;
      if (!existingInvoice)
        return res.status(404).json({ message: "Invoice not found" });

      const parsedData = {
        discount: discount || existingInvoice.discount,
        total: total || existingInvoice.total,
        amount_due: amount_due || existingInvoice.amount_due,
        currency: currency || existingInvoice.currency,
        paidmanual:
          paidmanual !== undefined ? paidmanual : existingInvoice.paidmanual,
        items: items || existingInvoice.items,
      };

      // Convert date fields to UTC if present
      if (parsedData.date_of_issue) {
        parsedData.date_of_issue = convertToUTC(parsedData.date_of_issue);
      }
      if (parsedData.date_due) {
        parsedData.date_due = convertToUTC(parsedData.date_due);
      }

      // Update the invoice
      const { data, error } = await supabase
        .from("demoinvoices")
        .update(parsedData)
        .eq("id", id)
        .select();

      if (error) throw error;

      const updatedInvoice = data[0];

      res.status(200).json({
        message: "Invoice updated successfully",
        invoice: updatedInvoice,
      });
    } catch (error) {
      console.error("Error updating invoice:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  },

  markInvoiceAsPaid: async (req, res) => {
    try {
      const { id } = req.params;
      const { paidStatus } = req.body; // Get the status from the request body

      const { data: existingInvoice, error: fetchError } = await supabase
        .from("demoinvoices")
        .select("*")
        .eq("id", id)
        .single();

      if (fetchError) throw fetchError;
      if (!existingInvoice)
        return res.status(404).json({ message: "Invoice not found" });

      // Update the invoice to mark it as paid/unpaid
      const { data, error } = await supabase
        .from("demoinvoices")
        .update({ paidstripe: paidStatus, paidmanual: paidStatus }) // Update both fields
        .eq("id", id)
        .select();

      if (error) throw error;

      const updatedInvoice = data[0];

      res.status(200).json({
        message: `Invoice marked as ${
          paidStatus ? "paid" : "unpaid"
        } successfully`,
        invoice: updatedInvoice,
      });
    } catch (error) {
      console.error("Error marking invoice as paid/unpaid:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  },

  getAllInvoices: async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit) : null;
      const userId = req.params.userId;

      if (!userId) {
        return res.status(400).json({ error: "User ID is required" });
      }

      if (limit !== null && (isNaN(limit) || limit <= 0 || limit > 100)) {
        return res.status(400).json({ error: "Invalid limit" });
      }

      let query = supabase
        .from("demoinvoices")
        .select("*", { count: "exact" })
        .eq("is_stripe_charge", false)
        .eq("user_id", userId); // Filter by user_id from params

      if (limit !== null) {
        query = query.limit(limit);
      }

      const { data, error, count } = await query;

      if (error) throw error;

      const formattedInvoices = data.map((invoice) => {
        const formatCurrency = (value) => {
          const numValue = parseFloat(value) || 0;
          return numValue.toFixed(2);
        };

        return {
          ...invoice,
          unit_price: invoice.unit_price,
          subtotal: invoice.subtotal,
          discount: invoice.discount,
          total: invoice.total,
          amount_due: invoice.amount_due,
        };
      });

      res.status(200).json({
        message: "Invoices fetched successfully",
        invoices: formattedInvoices,
        count: formattedInvoices.length,
        limit: limit,
        totalCount: count,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Get single invoice by ID
  getInvoiceById: async (req, res) => {
    try {
      const { data, error } = await supabase
        .from("demoinvoices")
        .select("*")
        .eq("id", req.params.id)
        .single();

      if (error) throw error;
      if (!data) return res.status(404).json({ error: "Invoice not found" });

      // Filter out null fields
      const filteredData = Object.keys(data)
        .filter((key) => data[key] !== null)
        .reduce((obj, key) => {
          obj[key] = data[key];
          return obj;
        }, {});

      res.status(200).json({
        message: "Invoice fetched successfully",
        invoice: filteredData,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  deleteInvoice: async (req, res) => {
    const { id } = req.params;

    try {
      // Fetch the invoice to be deleted
      const { data: invoice, error: fetchError } = await supabase
        .from("demoinvoices")
        .select("*")
        .eq("id", id)
        .single();

      if (fetchError) {
        throw fetchError;
      }

      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      // Insert the invoice into the deleted_invoices table
      const { error: insertError } = await supabase
        .from("deleted_invoices")
        .insert({
          id: invoice.id,
          user_id: invoice.user_id,
          invoice_number: invoice.invoice_number,
          deleted_at: new Date().toISOString(),
        });

      if (insertError) {
        throw insertError;
      }

      // Delete the invoice from the demoinvoices table
      const { error: deleteError } = await supabase
        .from("demoinvoices")
        .delete()
        .eq("id", id);

      if (deleteError) {
        throw deleteError;
      }

      res.status(200).json({ message: "Invoice deleted successfully" });
    } catch (error) {
      console.error("Error deleting invoice:", error);
      res.status(500).json({ message: "Can't delete the invoice" });
    }
  },
};

module.exports = invoiceController;
