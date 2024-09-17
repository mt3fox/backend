const { supabase } = require("../config/config");
const generateInvoice = require("../mail/pdfstripe");

const pdfDownloadController = {
  downloadInvoice: async (req, res) => {
    try {
      const { id } = req.params;

      // Fetch the main invoice data
      const { data: invoice, error } = await supabase
        .from("demoinvoices")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      if (!invoice) return res.status(404).json({ error: "Invoice not found" });

      console.log("invoice", invoice);


      const thankYouNote =
        invoice?.thankyou_note || "Thank you for your business!";

      // Check if items exist in the invoice object
      if (!Array.isArray(invoice.items) || invoice.items.length === 0) {
        // If no items, create a default item from the invoice data
        invoice.items = [
          {
            description: invoice.description || "Service",
            quantity: invoice.quantity || 1,
            unit_price:
              invoice.unit_price || parseFloat(invoice.total.replace("$", "")),
            subtotal:
              invoice.subtotal || parseFloat(invoice.total.replace("$", "")),
          },
        ];
      }

      // Generate PDF
      const pdf = await generateInvoice(invoice, thankYouNote);

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=Invoice-${invoice.invoice_number}.pdf`
      );

      console.log(
        "Set Content-Disposition:",
        `attachment; filename=Invoice-${invoice.invoice_number}.pdf`
      );
      res.send(pdf);
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ message: "Error downloading invoice", error: error.message });
    }
  },
};

module.exports = pdfDownloadController;
