const { supabase } = require("../config/config");
const stripe = require("stripe");
const crypto = require("crypto");

const algorithm = "aes-256-cbc";
const encryptionKey = Buffer.from(process.env.ENCRYPTION_KEY, "hex");

const stripeValidate = {
  validate: async (req, res) => {
    const { userId, stripeApiKey, senderEmail, fullName, stripeWebhookSecret } =
      req.body;

    try {
      // Encrypt the API key for storage
      const encryptedApiKey = encryptApiKey(stripeApiKey);

      // Validate the API key by attempting to list charges
      const stripeInstance = stripe(stripeApiKey);
      const charges = await stripeInstance.charges.list({ limit: 3 });

      if (charges.data.length === 0) {
        return res
          .status(400)
          .json({ error: "No charges found for this Stripe API key" });
      }

      // If we reach this point, the API key is valid
      // Update user information in Supabase
      const { data, error } = await supabase
        .from("users")
        .update({
          stripe_api_key: encryptedApiKey,
          sender_email: senderEmail,
          full_name: fullName,
          stripe_webhook_secret: stripeWebhookSecret,
          thankyou_note: "",
          // Store webhook secret as is
        })
        .eq("id", userId);

      if (error) throw error;

      res.status(200).json({
        message:
          "Stripe API key validated and user details updated successfully",
      });
    } catch (error) {
      console.error(
        "Error validating Stripe API key or updating user details:",
        error
      );
      res
        .status(400)
        .json({ error: "Invalid Stripe API key or unable to process request" });
    }
  },
  edit: async (req, res) => {
    const { userId } = req.params;
    const {
      stripe_api_key,
      sender_email,
      full_name,
      stripe_webhook_secret,
      thankyou_note,
    } = req.body;

    try {
      let updateData = {};
      let stripeValidated = false;
      let stripeWebhookValidated = false;

      if (sender_email !== undefined) updateData.sender_email = sender_email;
      if (full_name !== undefined) updateData.full_name = full_name;
      if (thankyou_note !== undefined) updateData.thankyou_note = thankyou_note;

      // Special handling for Stripe API key
      if (stripe_api_key !== undefined) {
        try {
          const stripeInstance = stripe(stripe_api_key);
          const charges = await stripeInstance.charges.list({ limit: 3 });

          if (charges.data.length > 0) {
            // API key is valid and has at least one charge
            updateData.stripe_api_key = encryptApiKey(stripe_api_key);
            stripeValidated = true;
          } else {
            return res
              .status(400)
              .json({ error: "No charges found for this Stripe API key" });
          }
        } catch (stripeError) {
          return res.status(400).json({ error: "Invalid Stripe API key" });
        }
      }

      // Handle Stripe Webhook Secret
      if (stripe_webhook_secret !== undefined) {
        // Store webhook secret as is
        updateData.stripe_webhook_secret = stripe_webhook_secret;
        stripeWebhookValidated = true;
      }

      // Only proceed with the update if there's data to update
      if (Object.keys(updateData).length > 0) {
        // Update user information in Supabase
        const { data, error } = await supabase
          .from("users")
          .update(updateData)
          .eq("id", userId);

        if (error) throw error;

        let message = "User details updated successfully";
        if (stripeValidated) {
          message += ", Stripe API key validated, and new charges stored";
        }
        if (stripeWebhookValidated) {
          message += ", and Stripe Webhook Secret updated";
        }

        res.status(200).json({ message });
      } else {
        res.status(400).json({ error: "No valid fields to update" });
      }
    } catch (error) {
      console.error("Error updating user details:", error);
      res.status(500).json({ error: "Error updating user details" });
    }
  },
  getDetails: async (req, res) => {
    const { userId } = req.params;

    try {
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", userId)
        .single();

      if (error) throw error;

      // Decrypt the API key for response
      if (data.stripe_api_key) {
        data.stripe_api_key = decryptApiKey(data.stripe_api_key);
      }
      // Webhook secret is sent as is
      res.status(200).json(data);
    } catch (error) {
      console.error("Error fetching user details:", error);
      res.status(400).json({ error: "Unable to fetch user details" });
    }
  },
};

function encryptApiKey(apiKey) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, encryptionKey, iv);
  let encrypted = cipher.update(apiKey, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

function decryptApiKey(encryptedApiKey) {
  const textParts = encryptedApiKey.split(":");
  const iv = Buffer.from(textParts.shift(), "hex");
  const encryptedText = Buffer.from(textParts.join(":"), "hex");
  const decipher = crypto.createDecipheriv(algorithm, encryptionKey, iv);
  let decrypted = decipher.update(encryptedText, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

module.exports = stripeValidate;
