const { stripe } = require("../config/config");
const { supabase } = require("../config/config");

async function deletePriceRecord(priceId) {
  try {
    console.log("Deleting price:", priceId);

    // Delete the price record from the Supabase 'prices' table
    const { error: deleteError } = await supabase
      .from("prices")
      .delete()
      .eq("id", priceId);

    if (deleteError) {
      console.error("Error deleting price record:", deleteError.message);
      throw new Error("Internal Error");
    }

    console.log("Price deleted successfully");
  } catch (error) {
    console.error("Error deleting price:", error.message);
    throw error;
  }
}

async function deleteProductRecord(productId) {
  try {
    console.log("Deleting product:", productId);

    // Delete the product record from the Supabase 'products' table
    const { error: deleteError } = await supabase
      .from("products")
      .delete()
      .eq("id", productId);

    if (deleteError) {
      console.error("Error deleting product record:", deleteError.message);
      throw new Error("Internal Error");
    }

    console.log("Product deleted successfully");
  } catch (error) {
    console.error("Error deleting product:", error.message);
    throw error;
  }
}
const webhookbackend = {
  handleWebhooks: async (req, res) => {
    const relevantEvents = new Set([
      "product.created",
      "product.updated",
      "product.deleted",
      "price.created",
      "price.updated",
      "price.deleted",
      "checkout.session.completed",
      "customer.subscription.created",
      "customer.subscription.updated",
      "customer.subscription.deleted",
    ]);

    const body = req.body;
    const sig = req.headers["stripe-signature"];

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;

    try {
      if (!sig || !webhookSecret)
        return res
          .status(400)
          .send("Webhook Error: Signature or webhook secret not provided");
      event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
    } catch (err) {
      console.log(`❌ Error message: ${err.message}`);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    console.log(`Received event: ${event.type}`);

    if (relevantEvents.has(event.type)) {
      try {
        switch (event.type) {
          case "product.created":
            console.log("Handling product.created event:", event.data.object);
            await upsertProductRecord(event.data.object);
            break;
          case "product.updated":
            console.log("Handling product.updated event:", event.data.object);
            await upsertProductRecord(event.data.object);
            break;

          case "price.deleted":
            console.log("Handling price.deleted event:", event.data.object);
            await deletePriceRecord(event.data.object.id);
            break;
          case "product.deleted":
            console.log("Handling product.deleted event:", event.data.object);
            await deleteProductRecord(event.data.object.id);
            break;
          case "price.created":
            console.log("Handling price.created event:", event.data.object);
            await upsertPriceRecord(event.data.object);
            break;
          case "price.updated":
            console.log("Handling price.updated event:", event.data.object);
            await upsertPriceRecord(event.data.object);
            break;

          case "customer.subscription.created":
            console.log(
              "Handling customer.subscription.created event:",
              event.data.object
            );
            const createdSubscription = event.data.object;
            await manageSubscriptionStatusChange(
              createdSubscription.id,
              createdSubscription.customer,
              true
            );
            break;
          case "customer.subscription.updated":
            console.log(
              "Handling customer.subscription.updated event:",
              event.data.object
            );
            const updatedSubscription = event.data.object;
            await manageSubscriptionStatusChange(
              updatedSubscription.id,
              updatedSubscription.customer,
              false
            );
            break;
          case "customer.subscription.deleted":
            console.log(
              "Handling customer.subscription.deleted event:",
              event.data.object
            );
            const deletedSubscription = event.data.object;
            await manageSubscriptionStatusChange(
              deletedSubscription.id,
              deletedSubscription.customer,
              false
            );
            break;
          case "checkout.session.completed":
            console.log(
              "Handling checkout.session.completed event:",
              event.data.object
            );
            const checkoutSession = event.data.object;
            if (checkoutSession.mode === "subscription") {
              const subscriptionId = checkoutSession.subscription;
              await manageSubscriptionStatusChange(
                subscriptionId,
                checkoutSession.customer,
                true
              );

              // Retrieve the subscription and payment method
              const subscription = await stripe.subscriptions.retrieve(
                subscriptionId
              );
              const paymentMethodId = subscription.default_payment_method;
              const paymentMethod = await stripe.paymentMethods.retrieve(
                paymentMethodId
              );

              // Copy billing details to customer
              await copyBillingDetailsToCustomer(
                checkoutSession.metadata.userId, // Assuming you've added userId to the session metadata
                paymentMethod
              );
            }
            break;
          default:
            throw new Error("Unhandled relevant event!");
        }
      } catch (error) {
        console.error("Webhook handler failed. View logs.", error);
        return res
          .status(400)
          .json({ error: "Webhook handler failed. View logs." });
      }
    }

    res.json({ received: true });
  },
};

async function upsertProductRecord(product) {
  const productData = {
    id: product.id,
    active: product.active,
    name: product.name,
    description: product.description,
    image: product.images?.[0] || null,
    metadata: product.metadata,
  };

  const { error } = await supabase.from("products").upsert([productData]);
  if (error) throw error;
}

async function upsertPriceRecord(price) {
  const priceData = {
    id: price.id,
    product_id: typeof price.product === "string" ? price.product : "",
    active: price.active,
    currency: price.currency,
    description: price.nickname,
    type: price.type,
    unit_amount: price.unit_amount,
    interval: price.recurring?.interval || null,
    interval_count: price.recurring?.interval_count || null,
    trial_period_days: price.recurring?.trial_period_days || null,
    metadata: price.metadata,
  };

  const { error } = await supabase.from("prices").upsert([priceData]);
  if (error) throw error;
}

async function manageSubscriptionStatusChange(
  subscriptionId,
  customerId,
  isCreate
) {
  try {
    console.log("subscriptionId:", subscriptionId);
    console.log("customerId:", customerId);
    console.log("isCreate:", isCreate);

    // Get the customer's UUID from the Supabase mapping table
    const { data: customerData, error: noCustomerError } = await supabase
      .from("customers")
      .select("id")
      .eq("stripe_customer_id", customerId)
      .single();

    if (noCustomerError) {
      console.error("Error fetching customer data:", noCustomerError.message);
      throw new Error("Internal Error");
    }

    const { id: uuid } = customerData;

    // Retrieve the subscription from Stripe
    const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ["default_payment_method"],
    });

    const subscriptionData = {
      id: subscription.id,
      user_id: uuid,
      metadata: subscription.metadata,
      status: subscription.status,
      price_id: subscription.items.data[0].price.id,
      quantity: subscription.quantity,
      cancel_at_period_end: subscription.cancel_at_period_end,
      cancel_at: subscription.cancel_at
        ? new Date(subscription.cancel_at * 1000).toISOString()
        : null,
      canceled_at: subscription.canceled_at
        ? new Date(subscription.canceled_at * 1000).toISOString()
        : null,
      current_period_start: new Date(
        subscription.current_period_start * 1000
      ).toISOString(),
      current_period_end: new Date(
        subscription.current_period_end * 1000
      ).toISOString(),
      created: new Date(subscription.created * 1000).toISOString(),
      ended_at: subscription.ended_at
        ? new Date(subscription.ended_at * 1000).toISOString()
        : null,
      trial_start: subscription.trial_start
        ? new Date(subscription.trial_start * 1000).toISOString()
        : null,
      trial_end: subscription.trial_end
        ? new Date(subscription.trial_end * 1000).toISOString()
        : null,
    };

    // Upsert the subscription data in Supabase
    const { error: upsertError } = await supabase
      .from("subscriptions")
      .upsert([subscriptionData]);

    if (upsertError) {
      console.error("Error updating subscription data:", upsertError.message);
      throw new Error("Internal Error");
    }

    // Return or log a success message
    console.log(`Subscription status ${isCreate ? "created" : "updated"}`);
  } catch (error) {
    console.error("Error managing subscription status change:", error.message);
    throw error;
  }
}

async function copyBillingDetailsToCustomer(uuid, payment_method) {
  const customer = payment_method.customer;
  const { name, phone, address } = payment_method.billing_details;

  if (!name || !phone || !address) {
    console.log("Missing billing details");
    return;
  }

  try {
    // Update Stripe customer
    await stripe.customers.update(customer, { name, phone, address });

    // Update Supabase user
    const { error } = await supabase
      .from("users")
      .update({
        billing_address: { ...address },
        payment_method: { ...payment_method[payment_method.type] },
      })
      .eq("id", uuid);

    if (error) throw error;

    console.log(`Billing details updated for user: ${uuid}`);
  } catch (error) {
    console.error("Error copying billing details:", error);
    throw error;
  }
}

module.exports = webhookbackend;
