const mailSender = require("../mail/mailsend");
const { supabase } = require("../config/config");
const generateInvoicePDF = require("../mail/pdfstripe");

const mailController = {
  sendInvoice: async (userId, invoiceId) => {
    try {
      console.log(`Fetching invoice: ${invoiceId} for user: ${userId}`);
      const { data: invoice, error } = await supabase
        .from("demoinvoices")
        .select("*")
        .eq("id", invoiceId)
        .eq("user_id", userId)
        .single();

      if (error) {
        console.error("Supabase error:", error);
        throw error;
      }
      if (!invoice) {
        console.error("Invoice not found");
        throw new Error("Invoice not found");
      }

      if (!Array.isArray(invoice.items) || invoice.items.length === 0) {
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

      const thankYouNote =
        invoice.thankyou_note || "Thank you for your business!";
      const pdfBuffer = await generateInvoicePDF(invoice, thankYouNote);

      // Email content
      const emailContent = `<h1>Invoice</h1> #${invoice.invoice_number}
       <p>Please find your invoice attached.</p>`;

      console.log("Sending email...");
      const result = await mailSender(
        invoice.bill_to_email,
        `Invoice #${invoice.invoice_number}`,
        emailContent,
        [
          {
            filename: `Invoice_${invoice.invoice_number}.pdf`,
            content: pdfBuffer.toString("base64"),
          },
        ]
      );

      try {
        // Fetch current email tracking record
        const { data: emailTracking, error: trackingFetchError } =
          await supabase
            .from("email_tracking")
            .select("*")
            .eq("user_id", invoice.user_id)
            .single();

        if (trackingFetchError) {
          console.error(
            "Error fetching email tracking data:",
            trackingFetchError
          );
        }

        // Determine the new counts
        let updatedTrackingData = {};
        if (invoice.is_stripe_charge) {
          updatedTrackingData.stripe_invoice_emails_sent =
            (emailTracking?.stripe_invoice_emails_sent || 0) + 1;
        } else {
          updatedTrackingData.manual_invoice_emails_sent =
            (emailTracking?.manual_invoice_emails_sent || 0) + 1;
        }

        // Upsert the email_tracking table
        const { data: trackingData, error: trackingError } = await supabase
          .from("email_tracking")
          .upsert(
            {
              user_id: invoice.user_id,
              ...updatedTrackingData,
            },
            { onConflict: "user_id" }
          )
          .single();

        if (trackingError) {
          console.error("Error in storing email stats:", trackingError);
        }
      } catch (error) {
        console.error("Error in storing stats:", error);
      }

      console.log(
        `Invoice #${invoice.invoice_number} sent and tracked successfully`
      );

      console.log("Email sent successfully");
      return { success: true, message: "Invoice sent successfully" };
    } catch (error) {
      console.error("Error in sendInvoice:", error);
      throw error;
    }
  },

  filteredInvoicessend: async (req, res) => {
    const { userId, invoiceIds } = req.body;

    try {
      for (const invoiceId of invoiceIds) {
        console.log(`Fetching invoice: ${invoiceId} for user: ${userId}`);

        const { data: invoice, error } = await supabase
          .from("demoinvoices")
          .select("*")
          .eq("id", invoiceId)
          .eq("user_id", userId)
          .single();

        if (error) {
          console.error("Supabase error:", error);
          continue; 
        }
        if (!invoice) {
          console.error("Invoice not found");
          continue;
        }

        if (!Array.isArray(invoice.items) || invoice.items.length === 0) {
        
          invoice.items = [
            {
              description: invoice.description || "Service",
              quantity: invoice.quantity || 1,
              unit_price:
                invoice.unit_price ||
                parseFloat(invoice.total.replace("$", "")),
              subtotal:
                invoice.subtotal || parseFloat(invoice.total.replace("$", "")),
            },
          ];
        }

        const thankYouNote =
          invoice?.thankyou_note || "Thank you for your business!";
        console.log("Generating PDF...");
        const pdfBuffer = await generateInvoicePDF(invoice, thankYouNote);

        // Email content
        const emailContent = `<h1>Invoice</h1> #${invoice.invoice_number}
       <p>Please find your invoice attached.</p>`;

        console.log("Sending email...");
        await mailSender(
          invoice.bill_to_email,
          `Invoice #${invoice.invoice_number}`,
          emailContent,
          [
            {
              filename: `Invoice_${invoice.invoice_number}.pdf`,
              content: pdfBuffer.toString("base64"),
            },
          ]
        );

        try {
          // Fetch current email tracking record
          const { data: emailTracking, error: trackingFetchError } =
            await supabase
              .from("email_tracking")
              .select("*")
              .eq("user_id", invoice.user_id)
              .single();

          if (trackingFetchError) {
            console.error(
              "Error fetching email tracking data:",
              trackingFetchError
            );
            continue; // Skip if there's an error fetching email tracking
          } else {
            console.log("Email tracking data fetched successfully");
          }

          // Determine the new counts
          let updatedTrackingData = {};
          if (invoice.is_stripe_charge) {
            updatedTrackingData.stripe_invoice_emails_sent =
              (emailTracking?.stripe_invoice_emails_sent || 0) + 1;
          } else {
            updatedTrackingData.manual_invoice_emails_sent =
              (emailTracking?.manual_invoice_emails_sent || 0) + 1;
          }

          // Upsert the email_tracking table
          const { data: trackingData, error: trackingError } = await supabase
            .from("email_tracking")
            .upsert(
              {
                user_id: invoice.user_id,
                ...updatedTrackingData,
              },
              { onConflict: "user_id" }
            )
            .single();

          if (trackingError) {
            console.error("Error in storing email stats:", trackingError);
            continue; // Log the error and continue processing the next invoice
          }
        } catch (error) {
          console.error("Error in storing stats:", error);
          continue; // Continue with the next invoice
        }

        console.log(
          `Invoice #${invoice.invoice_number} sent and tracked successfully`
        );
      }
      res
        .status(201)
        .json({ success: true, message: "Invoices processed successfully" });
    } catch (error) {
      console.error("Error in sendInvoices:", error);
      res
        .status(500)
        .json({ success: false, message: "Error processing invoices" });
    }
  },
  sendInvoiceManual: async (req, res) => {
    try {
      const { id } = req.params;

      const { data: invoice, error } = await supabase
        .from("demoinvoices")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      if (!invoice) return res.status(404).json({ error: "Invoice not found" });

   
      if (!Array.isArray(invoice.items) || invoice.items.length === 0) {
     
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

      const thankYouNote =
        invoice.thankyou_note || "Thank you for your business!";
      // Generate PDF
      const pdfBuffer = await generateInvoicePDF(invoice, thankYouNote);

      // Email content
      const emailContent = `<h1>Invoice</h1>
       <p>Please find your invoice attached.</p>`;

      // Send email with PDF attachment
      const result = await mailSender(
        invoice.bill_to_email,
        `Invoice #${invoice.invoice_number}`,
        emailContent,
        [
          {
            filename: `Invoice_${invoice.invoice_number}.pdf`,
            content: pdfBuffer.toString("base64"),
          },
        ]
      );

      try {
        // Fetch current email tracking record
        const { data: emailTracking, error: trackingFetchError } =
          await supabase
            .from("email_tracking")
            .select("*")
            .eq("user_id", invoice.user_id)
            .single();

        if (trackingFetchError) {
          console.error(
            "Error fetching email tracking data:",
            trackingFetchError
          );
        }

        // Determine the new counts
        let updatedTrackingData = {};
        if (invoice.is_stripe_charge) {
          updatedTrackingData.stripe_invoice_emails_sent =
            (emailTracking?.stripe_invoice_emails_sent || 0) + 1;
        } else {
          updatedTrackingData.manual_invoice_emails_sent =
            (emailTracking?.manual_invoice_emails_sent || 0) + 1;
        }

        // Upsert the email_tracking table
        const { data: trackingData, error: trackingError } = await supabase
          .from("email_tracking")
          .upsert(
            {
              user_id: invoice.user_id,
              ...updatedTrackingData,
            },
            { onConflict: "user_id" }
          )
          .single();

        if (trackingError) {
          console.error("Error in storing email stats:", trackingError);
        }
      } catch (error) {
        console.error("Error in storing stats:", error);
      }

      console.log(
        `Invoice #${invoice.invoice_number} sent and tracked successfully`
      );

      if (result) {
        res.status(200).json({ message: "Invoice sent successfully" });
      } else {
        res.status(500).json({ message: "Error sending invoice" });
      }
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ message: "Error sending invoice", error: error.message });
    }
  },
  sendAllInvoices: async (req, res) => {
    try {
      const { data: invoices, error } = await supabase
        .from("demoinvoices")
        .select("*");

      if (error) throw error;
      if (!invoices || invoices.length === 0)
        return res.status(404).json({ error: "Invoices not found" });

      for (const invoice of invoices) {
        // Fetch the thank you note
        const { data: invoiceData, error: invoiceError } = await supabase
          .from("demoinvoices")
          .select("thankyou_note")
          .eq("id", invoice.id)
          .single();

        if (invoiceError) {
          console.error("Error fetching user:", invoiceError);
     
          continue;
        }

   
        if (!Array.isArray(invoice.items) || invoice.items.length === 0) {
     
          invoice.items = [
            {
              description: invoice.description || "Service",
              quantity: invoice.quantity || 1,
              unit_price:
                invoice.unit_price ||
                parseFloat(invoice.total.replace("$", "")),
              subtotal:
                invoice.subtotal || parseFloat(invoice.total.replace("$", "")),
            },
          ];
        }

        const thankYouNote =
          invoiceData?.thankyou_note || "Thank you for your business!";

        // Generate PDF for each invoice
        const pdfBuffer = await generateInvoicePDF(invoice, thankYouNote);

        const emailContent = `
        <h1>Invoice #${invoice.invoice_number}</h1>
        <p>Please find your invoice attached.</p>
      `;

        const result = await mailSender(
          invoice.bill_to_email,
          `Invoice #${invoice.invoice_number}`,
          emailContent,
          [
            {
              filename: `Invoice_${invoice.invoice_number}.pdf`,
              content: pdfBuffer.toString("base64"),
            },
          ]
        );

        if (!result) {
          console.error(`Failed to send invoice #${invoice.invoice_number}`);
          // Continue with the next invoice instead of throwing an error
          continue;
        }

        try {
          // Fetch current email tracking record
          const { data: emailTracking, error: trackingFetchError } =
            await supabase
              .from("email_tracking")
              .select("*")
              .eq("user_id", invoice.user_id)
              .single();

          if (trackingFetchError) {
            console.error(
              "Error fetching email tracking data:",
              trackingFetchError
            );
            continue; // Skip if there's an error fetching email tracking
          }

          // Determine the new counts
          let updatedTrackingData = {};
          if (invoice.is_stripe_charge) {
            updatedTrackingData.stripe_invoice_emails_sent =
              (emailTracking?.stripe_invoice_emails_sent || 0) + 1;
          } else {
            updatedTrackingData.manual_invoice_emails_sent =
              (emailTracking?.manual_invoice_emails_sent || 0) + 1;
          }

          // Upsert the email_tracking table
          const { data: trackingData, error: trackingError } = await supabase
            .from("email_tracking")
            .upsert(
              {
                user_id: invoice.user_id,
                ...updatedTrackingData,
              },
              { onConflict: "user_id" }
            )
            .single();

          if (trackingError) {
            console.error("Error in storing email stats:", trackingError);
            continue; // Log the error and continue processing the next invoice
          }
        } catch (error) {
          console.error("Error in storing stats:", error);
          continue; // Continue with the next invoice
        }

        console.log(
          `Invoice #${invoice.invoice_number} sent and tracked successfully`
        );
      }

      res.status(200).json({ message: "All invoices sent successfully" });
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ message: "Error sending invoices", error: error.message });
    }
  },
};

module.exports = mailController;
