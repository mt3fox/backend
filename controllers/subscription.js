const { supabase } = require("../config/config");
const subscriptionCache = {}; // Cache object to store subscription statuses
const CACHE_EXPIRY_MS = 5 * 60 * 1000; // Cache expiry time (5 minutes)

const getCachedSubscriptionStatus = (userId) => {
  const cacheEntry = subscriptionCache[userId];
  if (cacheEntry) {
    const { status, timestamp } = cacheEntry;
    // Check if cache has expired
    if (Date.now() - timestamp < CACHE_EXPIRY_MS) {
      return status;
    } else {
      // Cache expired, remove entry
      delete subscriptionCache[userId];
    }
  }
  return null;
};

const setCachedSubscriptionStatus = (userId, status) => {
  subscriptionCache[userId] = {
    status,
    timestamp: Date.now(),
  };
};
const subscriptionController = {
  subscribe: async (req, res) => {
    const userId = req.params.userId;

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    // Check the cache first
    const cachedStatus = getCachedSubscriptionStatus(userId);
    if (cachedStatus) {
      return res.json({ status: cachedStatus });
    }

    try {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("status")
        .eq("user_id", userId)
        .order("current_period_end", { ascending: false })
        .limit(1)
        .single();

      if (error) throw error;

      const subscriptionStatus = data?.status || "inactive";

      // Cache the result
      setCachedSubscriptionStatus(userId, subscriptionStatus);

      res.json({ status: subscriptionStatus });
    } catch (error) {
      console.error("Error fetching subscription status:", error);
      res.status(500).json({
        error: "Error fetching subscription status",
        status: "inactive",
      });
    }
  },

  fetchAutoSendInvoiceStatus: async (req, res) => {
    const { userId } = req.params;

    try {
      const { data, error } = await supabase
        .from("users")
        .select("auto_send_invoice")
        .eq("id", userId)
        .single();

      if (error) {
        console.error("Error fetching auto_send_invoice status:", error);
        return res
          .status(500)
          .json({ error: "Failed to fetch auto-send invoice status" });
      }

      res.json({ autoSendInvoice: data.auto_send_invoice });
    } catch (error) {
      console.error("Error fetching auto_send_invoice status:", error);
      return res
        .status(500)
        .json({ error: "Failed to fetch auto-send invoice status" });
    }
  },

  updateAutoSendInvoiceStatus: async (req, res) => {
    const { userId } = req.params;
    const { newValue } = req.body;

    try {
      const { error } = await supabase
        .from("users")
        .update({ auto_send_invoice: newValue })
        .eq("id", userId);

      if (error) {
        console.error("Error updating auto_send_invoice:", error);
        return res
          .status(500)
          .json({ error: "Failed to update auto-send invoice setting" });
      }

      res.json({
        message: `Auto-send invoice ${newValue ? "enabled" : "disabled"}`,
      });
    } catch (error) {
      console.error("Error updating auto_send_invoice:", error);
      return res
        .status(500)
        .json({ error: "Failed to update auto-send invoice setting" });
    }
  },
  checkWebhookStatus: async (req, res) => {
    const { userId } = req.params;

    try {
      const { data, error } = await supabase
        .from("users")
        .select("stripe_webhook_secret")
        .eq("id", userId)
        .single();

      if (error) {
        console.error("Error checking webhook status:", error);
        return res
          .status(500)
          .json({ error: "Failed to check webhook status" });
      }

      const webhookStatus = data.stripe_webhook_secret
        ? "active" || "trailing"
        : "inactive";
      res.json({ webhookStatus });
    } catch (error) {
      console.error("Error checking webhook status:", error);
      return res.status(500).json({ error: "Failed to check webhook status" });
    }
  },

  getsubscriptionAmount: async (req, res) => {
    const { userId } = req.params;

    try {
      const { data, error } = await supabase
        .from("subscriptions")
        .select(
          `
      price_id,
      prices (
        unit_amount,
        currency,
        active
      )
    `
        )
        .eq("user_id", userId)
        .limit(1);

      if (error) {
        console.error("Error fetching subscription Amount:", error);
        return res.status(500).json({
          error: "Error fetching subscription Amount",
          status: "inactive",
        });
      }

      if (data && data.length > 0 && data[0].prices) {
        const { unit_amount, currency, active } = data[0].prices;
        res.json({
          amount: unit_amount,
          currency,
          active,
        });
      } else {
        console.log("No active subscription found for the user");
        return res.status(404).json({
          error: "No active subscription found for the user",
        });
      }
    } catch (error) {
      console.error("Error fetching subscription Amount:", error);
      res.status(500).json({
        error: "Error fetching subscription Amount",
        status: "inactive",
      });
    }
  },
};

module.exports = subscriptionController;
