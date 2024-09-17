require("dotenv").config();
const { supabase } = require("../config/config");

const { stripe } = require("../config/config");

const billingPortal = {
  createCustomer: async (req, res) => {
    const { userId } = req.body;
    try {
      const { data: subscriptions, error: subscriptionError } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", userId);

      if (subscriptionError) {
        console.error(
          "Error fetching subscriptions:",
          subscriptionError.message
        );
        throw new Error("Internal Error");
      }

      if (subscriptions.length > 0) {
        const { data: customer, error: customerError } = await supabase
          .from("customers")
          .select("stripe_customer_id")
          .eq("id", userId)
          .single();

        if (customerError) {
          console.error("Error fetching customer:", customerError.message);
          throw new Error("Internal Error");
        }

        if (customer && customer.stripe_customer_id) {
          const stripeSession = await stripe.billingPortal.sessions.create({
            customer: customer.stripe_customer_id,
            return_url: `https://pineappleinvoice.vercel.app/dashboard/plans?userId=${userId}`,
          });

          return res.status(200).json({ url: stripeSession.url });
        } else {
          return res
            .status(404)
            .json({ error: "No Stripe customer ID found for the user" });
        }
      } else {
        return res
          .status(404)
          .json({ error: "No subscriptions found for the user" });
      }
    } catch (error) {
      console.error("Error creating customer Billing Portal:", error.message);
      res.status(500).send("Internal Error");
    }
  },
};

module.exports = billingPortal;
