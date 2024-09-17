const express = require("express");
const { supabase } = require("../config/config");
const stripe = require("stripe");
const crypto = require("crypto");
const formatAmount = require("../libs/currencyFormat");
const router = express.Router();
const notificationController = require("../controllers/notification");

const algorithm = "aes-256-cbc";
const encryptionKey = Buffer.from(process.env.ENCRYPTION_KEY, "hex");

function decryptApiKey(encryptedApiKey) {
  const textParts = encryptedApiKey.split(":");
  const iv = Buffer.from(textParts.shift(), "hex");
  const encryptedText = Buffer.from(textParts.join(":"), "hex");
  const decipher = crypto.createDecipheriv(algorithm, encryptionKey, iv);
  let decrypted = decipher.update(encryptedText, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

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

const webhookc = {
  activateWebhook: async (req, res) => {
    const { userId } = req.params;
    console.log("User ID from activate ", userId);

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    try {
      // Fetch user's Stripe secrets from the database
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("stripe_api_key, stripe_webhook_secret")
        .eq("id", userId)
        .single();

      console.log("User data from activate ", userData);

      if (userError || !userData) {
        console.error("Error fetching user data:", userError);
        return res.status(400).json({ error: "Error fetching user data" });
      }

      const stripeApiKey = decryptApiKey(userData.stripe_api_key);

      const stripeInstance = stripe(stripeApiKey);

      const webhookEndpoint = await stripeInstance.webhookEndpoints.create({
        url: `https://pineapple-invoice-api.onrender.com/api/webhook/${userId}`,
        enabled_events: ["payment_intent.succeeded", "charge.succeeded"],
      });
      // Save the webhook secret
      const { error: updateError } = await supabase
        .from("users")
        .update({ stripe_webhook_secret: webhookEndpoint.secret })
        .eq("id", userId);

      console.log("Webhook endpoint from activate ", webhookEndpoint);

      if (updateError) {
        throw updateError;
      }

      res.json({
        message: "Webhook activated successfully",
        webhookUrl: webhookEndpoint.url,
        enabled_events: webhookEndpoint.enabled_events,
      });
    } catch (error) {
      console.error("Error activating webhook:", error);
      res.status(500).json({ error: "Failed to activate webhook" });
    }
  },

  handleWebhook: async (req, res) => {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    // Fetch user's Stripe secrets from the database
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("stripe_api_key, stripe_webhook_secret")
      .eq("id", userId)
      .single();

    if (userError || !userData) {
      console.error("Error fetching user data:", userError);
      return res.status(400).json({ error: "Error fetching user data" });
    }

    const stripeApiKey = decryptApiKey(userData.stripe_api_key);
    const endpointSecret = userData.stripe_webhook_secret;

    const stripeInstance = stripe(stripeApiKey);

    const sig = req.headers["Stripe-Signature"];
    const payload = req.body;

    let event;

    try {
      if (endpointSecret && sig) {
        event = stripeInstance.webhooks.constructEvent(
          payload,
          sig,
          endpointSecret
        );
      } else {
        console.log("Proceeding without verification.");
        event = JSON.parse(payload);
      }

      // Handle the event

      // Handle the event
      switch (event.type) {
        case "charge.succeeded":
          const paymentObject = event.data.object;
          console.log(`${event.type} for ${paymentObject.id}`);

          // Fetch company details
          const { data: companyDetails, error: companyError } = await supabase
            .from("company_details")
            .select("*")
            .eq("default", true)
            .single();

          console.log("Company details from handle webhook ", companyDetails);

          if (companyError) {
            console.error("Error fetching company details:", companyError);
            return res
              .status(500)
              .json({ error: "Error fetching company details" });
          }

          const invoiceNumber = await generateInvoiceNumber(userId);

          const items = [
            {
              quantity: 1,
              subtotal: formatAmount(
                paymentObject.amount,
                paymentObject.currency
              ),
              unit_price: formatAmount(
                paymentObject.amount,
                paymentObject.currency
              ),
              description: "Stripe Webhook Received Payment",
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

          const { data: newInvoice, error: invoiceError } = await supabase
            .from("demoinvoices")
            .insert(
              {
                user_id: userId,
                invoice_number: invoiceNumber,
                stripe_charge_id: paymentObject.id,
                stripe_amount: paymentObject.amount,
                stripe_currency: paymentObject.currency,
                stripe_customer: paymentObject.customer,
                stripe_payment_intent:
                  paymentObject.payment_intent || paymentObject.id,

                bill_to: paymentObject.billing_details?.name,
                bill_to_address_line_1:
                  paymentObject.billing_details?.address?.line1,
                bill_to_address_line_2:
                  paymentObject.billing_details?.address?.line2,
                bill_to_city: paymentObject.billing_details?.address?.city,
                bill_to_state: paymentObject.billing_details?.address?.state,
                bill_to_postal_code:
                  paymentObject.billing_details?.address?.postal_code,
                bill_to_country:
                  paymentObject.billing_details?.address?.country,
                bill_to_email: paymentObject.billing_details?.email,
                bill_to_phone: paymentObject.billing_details?.phone,
                items,
                discount: paymentObject.discount,
                thankyou_note: thankYouNote,
                total: formatAmount(
                  paymentObject.amount,
                  paymentObject.currency
                ),
                amount_due: formatAmount(
                  paymentObject.amount,
                  paymentObject.currency
                ),
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
                is_stripe_charge: true,
              },
              {
                paidstripe: true,
              }
            )
            .select()
            .single();

          if (invoiceError) {
            console.log("Error creating invoice", invoiceError);
            throw invoiceError;
          }

          console.log(
            `Invoice created for ${event.type} ${paymentObject.id} with number ${invoiceNumber}`
          );

          // Trigger asynchronous email sending
          setTimeout(() => sendInvoiceEmail(userId, newInvoice.id), 5000); // 5 second delay

          break;

        case "payment_intent.succeeded":
          const paymentIntent = event.data.object;
          console.log(`PaymentIntent ${paymentIntent.id} was ${event.type}!`);

          // Store the payment intent in Supabase
          const { error: intentError } = await supabase
            .from("payment_intents")
            .upsert({
              id: paymentIntent.id,
              amount: paymentIntent.amount,
              currency: paymentIntent.currency,
              customer: paymentIntent.customer,
              status: paymentIntent.status,
              payment_method: paymentIntent.payment_method,
              receipt_email: paymentIntent.receipt_email,
              created: new Date(paymentIntent.created * 1000).toISOString(),
              stripe_event_id: event.id,
              metadata: paymentIntent.metadata,
              user_id: userId,
            });

          if (intentError) {
            console.log("Error storing payment intent", intentError);
            throw intentError;
          }

          console.log(`Payment intent ${paymentIntent.id} stored successfully`);
          break;

        case "customer.subscription.created":
        case "customer.subscription.updated":
        case "customer.subscription.deleted":
          const subscription = event.data.object;
          console.log(`Subscription ${subscription.id} was ${event.type}`);

          const { error: subscriptionError } = await supabase
            .from("subscriptions_backend")
            .upsert({
              id: subscription.id,
              customer: subscription.customer,
              current_period_start: new Date(
                subscription.current_period_start * 1000
              ).toISOString(),
              current_period_end: new Date(
                subscription.current_period_end * 1000
              ).toISOString(),
              status: subscription.status,
              stripe_event_id: event.id,
              metadata: subscription.metadata,
            });

          if (subscriptionError) throw subscriptionError;

          console.log(`Subscription ${subscription.id} stored successfully`);
          break;

        default:
          console.log(`Unhandled event type ${event.type}.`);
      }

      console.log("Webhook processed successfully");
      res.json({ received: true });
    } catch (error) {
      console.error("Error handling event:", error);
      console.error("Request body:", req.body);
      console.error("Request headers:", req.headers);
      res.status(400).json({ error: `Webhook Error: ${error.message}` });
    }
  },
};

async function sendInvoiceEmail(userId, invoiceId) {
  try {
    // Fetch user's auto-send preference
    const { data: userPreference, error: preferenceError } = await supabase
      .from("users")
      .select("auto_send_invoice")
      .eq("id", userId)
      .single();

    if (preferenceError) {
      console.log("Error fetching user preference", preferenceError);
      return;
    }

    if (userPreference.auto_send_invoice) {
      const emailResult = await notificationController.sendInvoice(
        userId,
        invoiceId
      );
      if (emailResult.success) {
        console.log(
          `Invoice email sent automatically for invoice ${invoiceId}`
        );
      } else {
        console.error(`Failed to send invoice email: ${emailResult.message}`);
      }
    }
  } catch (error) {
    console.error("Error in sendInvoiceEmail:", error);
  }
}

module.exports = webhookc;
