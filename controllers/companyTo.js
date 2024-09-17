const { supabase } = require("../config/config");

const companyToController = {
  writeDetails: async (req, res) => {
    const id = req.params.id;
    try {
      const {
        bill_to,
        to_address_line_1,
        to_address_line_2,
        to_city,
        to_state,
        to_postal_code,
        to_country,
        to_email,
        to_phone,
      } = req.body;

      const { data, error } = await supabase
        .from("company_details_to")
        .insert([
          {
            user_id: id,
            bill_to,
            to_address_line_1,
            to_address_line_2,
            to_city,
            to_state,
            to_postal_code,
            to_country,
            to_email,
            to_phone,
          },
        ])
        .select("*");
      if (error) {
        return res.status(400).json({ error: error.message });
      }

      return res.status(200).json({
        message: "Company To details added successfully",
        data,
      });
    } catch (error) {
      console.error("Error Posting Company To Data:", error);
      res.status(500).json({ error: "Error Posting Company To Data" });
    }
  },

  getAllDetails: async (req, res) => {
    const id = req.params.id;
    try {
      const { data: companyDetailsTo, error } = await supabase
        .from("company_details_to")
        .select("*")
        .eq("user_id", id);

      if (error) {
        return res.status(400).json({ error: error.message });
      }

      return res.status(200).json({
        message: "Company To details fetched successfully",
        companyDetailsTo,
      });
    } catch (error) {
      console.error("Error Getting Company Details:", error);
      res.status(500).json({ error: "Error Getting Company Details" });
    }
  },

  updateDetails: async (req, res) => {
    const id = req.params.id;
    try {
      const {
        bill_to,
        to_address_line_1,
        to_address_line_2,
        to_city,
        to_state,
        to_postal_code,
        to_country,
        to_email,
        to_phone,
      } = req.body;

      const { data, error } = await supabase
        .from("company_details_to")
        .update({
          bill_to,
          to_address_line_1,
          to_address_line_2,
          to_city,
          to_state,
          to_postal_code,
          to_country,
          to_email,
          to_phone,
        })
        .eq("id", id)
        .select("*");

      if (error) {
        return res.status(400).json({ error: error.message });
      }

      return res.status(200).json({
        message: "Company To details updated successfully",
        data,
      });
    } catch (err) {
      console.log(err);
      res.status(500).json({ error: "Error Updating Company To Details" });
    }
  },

  deleteDetails: async (req, res) => {
    try {
      const id = req.params.id;
      const { data, error } = await supabase
        .from("company_details_to")
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
      res.status(500).json({ error: "Error Deleting Company To Details" });
    }
  },
};

module.exports = companyToController;
