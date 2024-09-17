const { supabase } = require("../config/config");

const statsController = {
  getEmailSentManualStats: async (req, res) => {
    const userId = req.params.userId;
    try {
      const { data, error } = await supabase
        .from("email_tracking")
        .select("manual_invoice_emails_sent")
        .eq("user_id", userId)
        .single();

      if (error) {
        return res.status(400).send({ message: error.message });
      }

      res.status(200).send(data);
    } catch (err) {
      console.log(err);
      res.status(500).send({ message: "Internal Server Error" });
    }
  },
  getEmailSentStripeStats: async (req, res) => {
    const userId = req.params.userId;
    try {
      const { data, error } = await supabase
        .from("email_tracking")
        .select("stripe_invoice_emails_sent")
        .eq("user_id", userId)
        .single();

      if (error) {
        return res.status(400).send({ message: error.message });
      }

      res.status(200).send(data);
    } catch (err) {
      console.log(err);
      res.status(500).send({ message: "Internal Server Error" });
    }
  },
  getSavedFromAdressesStats: async (req, res) => {
    const userId = req.params.userId;
    try {
      const { count, error } = await supabase
        .from("company_details")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId);

      if (error) {
        return res.status(400).send({ message: error.message });
      }

      res.status(200).send({ count });
    } catch (err) {
      console.log(err);
      res.status(500).send({ message: "Internal Server Error" });
    }
  },
  getSavedToAdressesStats: async (req, res) => {
    const userId = req.params.userId;
    try {
      const { count, error } = await supabase
        .from("company_details_to")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId);

      if (error) {
        return res.status(400).send({ message: error.message });
      }

      res.status(200).send({ count });
    } catch (err) {
      console.log(err);
      res.status(500).send({ message: "Internal Server Error" });
    }
  },
  getManualInvoicesStats: async (req, res) => {
    const userId = req.params.userId;
    try {
      const { count, error } = await supabase
        .from("demoinvoices")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("is_stripe_charge", false);

      if (error) {
        return res.status(400).send({ message: error.message });
      }

      res.status(200).send({ count });
    } catch (err) {
      console.log(err);
      res.status(500).send({ message: "Internal Server Error" });
    }
  },

  getStripeInvoicesStats: async (req, res) => {
    const userId = req.params.userId;

    try {
      const { count, error } = await supabase
        .from("demoinvoices")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("is_stripe_charge", true);

      if (error) {
        return res.status(400).send({ message: error.message });
      }

      res.status(200).send({ count });
    } catch (err) {
      console.log(err);
      res.status(500).send({ message: "Internal Server Error" });
    }
  },
  setInvoiceDownloadStats: async (req, res) => {
    const userId = req.params.userId;
    const { actionType } = req.body; // can be 'pdf', 'csv', 'export_csv', 'export_filtered_csv'

    try {
      let fieldToUpdate;

      switch (actionType) {
        case "pdf":
          fieldToUpdate = "downloads_pdf";
          break;
        case "csv":
          fieldToUpdate = "downloads_csv";
          break;
        case "exported_csv":
          fieldToUpdate = "exported_csv";
          break;
        case "exported_filtered_csv":
          fieldToUpdate = "exported_filtered_csv";
          break;
        default:
          return res.status(400).send({ message: "Invalid action type" });
      }

      const { data: existingRecords, error: checkError } = await supabase
        .from("export_stats")
        .select("*")
        .eq("user_id", userId)
        .limit(1);

      if (checkError) {
        return res.status(400).send({ message: checkError.message });
      }

      if (existingRecords.length === 0) {
        const { error: insertError } = await supabase
          .from("export_stats")
          .insert([
            {
              user_id: userId,
              downloads_pdf: 0,
              downloads_csv: 0,
              exported_csv: 0,
              exported_filtered_csv: 0,
            },
          ]);

        if (insertError) {
          return res.status(400).send({ message: insertError.message });
        }
      } else if (existingRecords.length > 1) {
        console.warn(`Multiple records found for user_id: ${userId}`);
      }

      // Increment the specified field
      const { data, error } = await supabase.rpc("increment_field", {
        field_name: fieldToUpdate,
        user_id_param: userId,
      });

      if (error) {
        return res.status(400).send({ message: error.message });
      }

      if (data.length > 0) {
        res.status(200).send(data[0]);
      } else {
        return res.status(404).send({ message: "Record not found" });
      }
    } catch (err) {
      console.log(err);
      res.status(500).send({ message: "Internal Server Error" });
    }
  },

  getDownloadStats: async (req, res) => {
    const userId = req.params.userId;

    try {
      // Fetch the statistics for the specified user
      const { data, error } = await supabase
        .from("export_stats")
        .select(
          "downloads_pdf, downloads_csv, exported_csv, exported_filtered_csv"
        )
        .eq("user_id", userId)
        .single();

      if (error) {
        return res.status(400).send({ message: error.message });
      }

      if (data) {
        res.status(200).send(data);
      } else {
        return res.status(404).send({ message: "Record not found" });
      }
    } catch (err) {
      console.log(err);
      res.status(500).send({ message: "Internal Server Error" });
    }
  },

  getpaidstats: async (req, res) => {
    const userId = req.params.userId;

    try {
      const { count: paidCount, error: paidError } = await supabase
        .from("demoinvoices")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .or("paidstripe.eq.true,paidmanual.eq.true");

      if (paidError) {
        console.error("Paid count query error:", paidError.message);
        return res.status(400).send({ message: paidError.message });
      }

      const { count: totalCount, error: totalCountError } = await supabase
        .from("demoinvoices")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId);

      if (totalCountError) {
        console.error(
          "Total invoices count query error:",
          totalCountError.message
        );
        return res.status(400).send({ message: totalCountError.message });
      }

      const unpaidCount = totalCount - paidCount;

      res.status(200).send({ paidCount, unpaidCount });
    } catch (err) {
      console.error("Internal Server Error:", err);
      res.status(500).send({ message: "Internal Server Error" });
    }
  },

  isEdited: async (req, res) => {
    const userId = req.params.userId;

    try {
      const { count: editedCount, error: editedError } = await supabase
        .from("demoinvoices")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("isedited", true);

      if (editedError) {
        console.error("Edited count query error:", editedError.message);
        return res.status(400).send({ message: editedError.message });
      }

      // Return the count of edited invoices
      res.status(200).send({ editedCount });
    } catch (err) {
      console.error("Internal Server Error:", err);
      res.status(500).send({ message: "Internal Server Error" });
    }
  },

  deleteCount: async (req, res) => {
    const userId = req.params.userId;

    try {
      // Fetch the count of deleted invoices for a specific user
      const { count: deletedCount, error } = await supabase
        .from("deleted_invoices")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId);

      if (error) {
        throw error;
      }

      res.status(200).json({ deletedCount });
    } catch (error) {
      console.error("Error fetching deleted invoice count:", error);
      res.status(500).json({ message: "Internal Server Error" });
    }
  },
};

module.exports = statsController;
