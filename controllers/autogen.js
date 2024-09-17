const { supabase } = require("../config/config");
const stripe = require("stripe");
const crypto = require("crypto");
const formatAmount = require("../libs/currencyFormat");
const { isEdited } = require("./stats");
const algorithm = "aes-256-cbc";
const encryptionKey = Buffer.from(process.env.ENCRYPTION_KEY, "hex");

const generateInvoiceNumber = async (userId) => {
  if (!userId) {
    throw new Error("User ID is required to generate an invoice number");
  }

  const { data, error } = await supabase
    .from("demoinvoices")
    .select("invoice_number")
    .eq("user_id", userId)
    .order("invoice_number", { ascending: false })
    .limit(1);

  if (error) throw error;

  if (data.length === 0) return "INV-000001";

  const lastInvoiceNumber = data[0].invoice_number;
  const numericPart = parseInt(lastInvoiceNumber.split("-")[1]);
  const newNumericPart = (numericPart + 1).toString().padStart(6, "0");
  return `INV-${newNumericPart}`;
};
const stripeDataController = {
  fetchAndStoreStripeData: async (req, res) => {
    const { userId } = req.body;

    try {
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("stripe_api_key")
        .eq("id", userId)
        .single();

      if (userError || !userData.stripe_api_key) {
        return res
          .status(400)
          .json({ error: "Stripe API key not found for user" });
      }

      const decryptedApiKey = decryptApiKey(userData.stripe_api_key);

      const stripeInstance = stripe(decryptedApiKey);

      let lastStoredChargeId;
      let allNewCharges = [];
      let hasMore = true;

      const fetchLimit = req.query.limit ? parseInt(req.query.limit) : 100;
      if (isNaN(fetchLimit) || fetchLimit <= 0 || fetchLimit > 100) {
        return res.status(400).json({ error: "Invalid limit" });
      }

      const { data: existingCharges, error: existingChargesError } =
        await supabase
          .from("demoinvoices")
          .select("stripe_charge_id")
          .eq("user_id", userId)
          .order("stripe_charge_id", { ascending: true })
          .limit(1);

      if (existingChargesError) throw existingChargesError;

      if (existingCharges.length > 0) {
        lastStoredChargeId = existingCharges[0].stripe_charge_id;
      }

      while (hasMore && allNewCharges.length < fetchLimit) {
        let charges;
        if (lastStoredChargeId) {
          charges = await stripeInstance.charges.list({
            limit: fetchLimit,
            starting_after: lastStoredChargeId,
          });
        } else {
          charges = await stripeInstance.charges.list({
            limit: fetchLimit,
          });
        }

        allNewCharges = [...allNewCharges, ...charges.data];
        hasMore = charges.has_more;

        if (charges.data.length > 0) {
          lastStoredChargeId = charges.data[charges.data.length - 1].id;
        }
      }

      let { data: companyDetails, error: companyError } = await supabase
        .from("company_details")
        .select("*")
        .eq("default", true)
        .single();

      if (!companyDetails) {
        const { data: latestCompanyDetails, error: latestCompanyError } =
          await supabase
            .from("company_details")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

        if (latestCompanyError || !latestCompanyDetails) {
          return res.status(400).json({
            error:
              "Please add your company details in the address book tab to fetch Stripe invoices",
          });
        }

        companyDetails = latestCompanyDetails;
      }

      for (const charge of allNewCharges) {
        const invoiceNumber = await generateInvoiceNumber(userId);
        const items = [
          {
            quantity: 1,
            subtotal: formatAmount(charge.amount, charge.currency),
            unit_price: formatAmount(charge.amount / 1, charge.currency),
            description: "Stripe Payment",
          },
        ];
        const { data: user, error: userError } = await supabase
          .from("users")
          .select("thankyou_note")
          .eq("id", userId)
          .single();

        if (userError) {
          console.error("Error fetching user:", userError);
          throw userError;
        }

        const thankYouNote =
          user.thankyou_note || "Thank you for your business!";
        const { data, error: invoiceError } = await supabase
          .from("demoinvoices")
          .upsert(
            {
              user_id: userId,
              invoice_number: invoiceNumber,
              stripe_charge_id: charge.id,
              stripe_amount: charge.amount,
              stripe_currency: charge.currency,
              stripe_customer: charge.customer,

              stripe_payment_intent: charge.payment_intent,

              date_of_issue: new Date(charge.created * 1000),

              bill_to: charge.billing_details.name,
              bill_to_address_line_1: charge.billing_details.address?.line1,
              bill_to_address_line_2: charge.billing_details.address?.line2,
              bill_to_city: charge.billing_details.address?.city,
              bill_to_state: charge.billing_details.address?.state,
              bill_to_postal_code: charge.billing_details.address?.postal_code,
              bill_to_country: charge.billing_details.address?.country,
              bill_to_email: charge.billing_details.email,
              bill_to_phone: charge.billing_details.phone,
              // Add "bill from" details from company_details
              bill_from: companyDetails.bill_from,
              bill_from_address_line_1: companyDetails.address_line_1,
              bill_from_address_line_2: companyDetails.address_line_2,
              bill_from_city: companyDetails.city,
              bill_from_state: companyDetails.state,
              bill_from_postal_code: companyDetails.postal_code,
              bill_from_country: companyDetails.country,
              bill_from_email: companyDetails.email,
              bill_from_phone: companyDetails.phone,
              items,
              discount: charge.discount ? `${charge.discount}%` : "0%",

              total: formatAmount(charge.amount, charge.currency),
              amount_due: formatAmount(charge.amount, charge.currency),
              is_stripe_charge: true,
              thankyou_note: thankYouNote,
            },
            {
              paidstripe: true,
            },
            {
              onConflict: "stripe_charge_id",
              ignoreDuplicates: false,
            }
          )
          .select();

        if (invoiceError) throw invoiceError;

        console.log(
          `Stored invoice for charge ${charge.id} with invoice number ${data[0].invoice_number}`
        );
      }

      res.status(200).json({
        message: "Stripe data fetched and stored successfully",
      });
    } catch (error) {
      console.error("Error fetching and storing Stripe data:", error);
      res.status(500).json({ error: "Error fetching and storing Stripe data" });
    }
  },

  editStripeInvoice: async (req, res) => {
    try {
      const { invoiceId, userId } = req.params;

      const {
        bill_from,
        bill_from_address_line_1,
        bill_from_address_line_2,
        bill_from_city,
        bill_from_state,
        bill_from_postal_code,
        bill_from_country,
        bill_from_email,
        bill_from_phone,
        bill_to,
      } = req.body;

      const { data: invoice, error: fetchError } = await supabase
        .from("demoinvoices")
        .select("*")
        .eq("id", invoiceId)
        .eq("user_id", userId)
        .single();

      if (fetchError || !invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      const { data, error } = await supabase
        .from("demoinvoices")
        .update({
          bill_from,
          bill_from_address_line_1,
          bill_from_address_line_2,
          bill_from_city,
          bill_from_state,
          bill_from_postal_code,
          bill_from_country,
          bill_from_email,
          bill_from_phone,
          bill_to,
          isedited: true,
        })
        .eq("id", invoiceId)
        .eq("user_id", userId);

      if (error) {
        console.error("Error updating invoice:", error);
        return res.status(500).json({ message: "Error updating invoice" });
      }

      res.status(200).json({
        message: "Invoice updated successfully",
      });
    } catch (error) {
      console.error("Error updating invoice:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  },

  getAllStripeInvoices: async (req, res) => {
    try {
      const userId = req.params.userId;

      if (!userId) {
        return res.status(400).json({ error: "User ID is required" });
      }

      const { data, error } = await supabase
        .from("demoinvoices")
        .select("*")
        .eq("is_stripe_charge", true)
        .eq("user_id", userId);

      if (error) {
        console.error("Supabase query error:", error);
        throw error;
      }

      // Filter out null fields
      const filteredData = data.map((row) => {
        return Object.keys(row)
          .filter((key) => row[key] !== null)
          .reduce((obj, key) => {
            obj[key] = row[key];
            return obj;
          }, {});
      });

      res.status(200).json({
        message: "All Stripe invoices fetched successfully",
        data: filteredData,
        count: filteredData.length,
      });
    } catch (error) {
      console.error("Error fetching all stripe invoices:", error);
      res.status(500).json({ error: "Error fetching all stripe invoices" });
    }
  },

  deleteStripeInvoice: async (req, res) => {
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

  checkInvoice: async (req, res) => {
    try {
      const { data, error } = await supabase
        .from("demoinvoices")
        .select("is_stripe_charge")
        .eq("id", req.params.id) // Ensure to match your actual primary key column
        .single();

      if (error) throw error;

      if (data) {
        res.status(200).json({ is_stripe_charge: data.is_stripe_charge });
      } else {
        res.status(404).json({ message: "Invoice not found" });
      }
    } catch (error) {
      res.status(500).json({ message: "Error checking invoice" });
    }
  },
};

function decryptApiKey(encryptedApiKey) {
  const textParts = encryptedApiKey.split(":");
  const iv = Buffer.from(textParts.shift(), "hex");
  const encryptedText = Buffer.from(textParts.join(":"), "hex");
  const decipher = crypto.createDecipheriv(algorithm, encryptionKey, iv);
  let decrypted = decipher.update(encryptedText, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

module.exports = stripeDataController;
