const { createClient } = require("@supabase/supabase-js");
const Stripe = require("stripe");
require("dotenv").config();

// Initialize Supabase client
const supabase = createClient(
  "https://tzkznqxojcjwimivhuci.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR6a3pucXhvamNqd2ltaXZodWNpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyMDAwNjExNywiZXhwIjoyMDM1NTgyMTE3fQ.eT3mXHWoqf3Nu0myciYaJx1pSSzLPlK7DBlKUw5uH_8"
);

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
  appInfo: {
    name: "Pineapple Invoice",
    version: "1.0.0",
  },
});
module.exports = {
  supabase,
  stripe,
};
