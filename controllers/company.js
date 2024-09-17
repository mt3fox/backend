const { supabase } = require("../config/config");

const companyController = {
  writeDetails: async (req, res) => {
    const id = req.params.id;
    try {
      const {
        bill_from,
        address_line_1,
        address_line_2,
        city,
        state,
        postal_code,
        country,
        email,
        phone,
      } = req.body;

      const { data, error } = await supabase
        .from("company_details")
        .insert([
          {
            user_id: id,
            bill_from,
            address_line_1,
            address_line_2,
            city,
            state,
            postal_code,
            country,
            email,
            phone,
          },
        ])
        .select("*");
      if (error) {
        return res.status(400).json({ error: error.message });
      }

      return res.status(200).json({
        message: "Company details added successfully",
        data,
      });
    } catch (error) {
      console.error("Error Posting Company Data:", error);
      res.status(500).json({ error: "Error Posting Company Data" });
    }
  },

  getAllDetails: async (req, res) => {
    const id = req.params.id;
    try {
      const { data: companyDetails, error } = await supabase
        .from("company_details")
        .select("*")
        .eq("user_id", id);

      if (error) {
        return res.status(400).json({ error: error.message });
      }

      return res.status(200).json({
        message: "Company details fetched successfully",
        companyDetails,
      });
    } catch (error) {
      console.error("Error Getting Company Details:", error);
      res.status(500).json({ error: "Error Getting Company Details" });
    }
  },

  setDefaultAddress: async (req, res) => {
    const id = req.params.id;

    try {
      const { default: isDefault } = req.body;

      // Assuming you're using Supabase JavaScript client
      const { data, error } = await supabase
        .from("company_details")
        .update({ default: isDefault })
        .eq("id", id);

      if (error) throw error;

      // If setting to true, reset other addresses to false
      if (isDefault) {
        const { error: resetError } = await supabase
          .from("company_details")
          .update({ default: false })
          .neq("id", id);

        if (resetError) throw resetError;
      }

      res.status(200).json({ message: "Default address updated successfully" });
    } catch (error) {
      console.error("Error updating default address:", error);
      res.status(500).json({ error: "Failed to update default address" });
    }
  },

  updateDetails: async (req, res) => {
    const id = req.params.id;
    try {
      const {
        bill_from,
        address_line_1,
        address_line_2,
        city,
        state,
        postal_code,
        country,
        email,
        phone,
      } = req.body;

      const { data, error } = await supabase
        .from("company_details")
        .update({
          bill_from,
          address_line_1,
          address_line_2,
          city,
          state,
          postal_code,
          country,
          email,
          phone,
        })
        .eq("id", id)
        .select("*");

      if (error) {
        return res.status(400).json({ error: error.message });
      }

      return res.status(200).json({
        message: "Company details updated successfully",
        data,
      });
    } catch (err) {
      console.log(err);
      res.status(500).json({ error: "Error Updating Company Details" });
    }
  },

  deleteDetails: async (req, res) => {
    try {
      const id = req.params.id;
      const { data, error } = await supabase
        .from("company_details")
        .delete()
        .eq("id", id)
        .select("*");

      if (error) {
        return res.status(400).json({ error: error.message });
      }

      return res.status(200).json({
        message: "Company details deleted successfully",
        data,
      });
    } catch (err) {
      console.log(err);
      res.status(500).json({ error: "Error Deleting Company Details" });
    }
  },
};

module.exports = companyController;
