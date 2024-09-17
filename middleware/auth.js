const { supabase } = require("../config/config");

const authenticate = async (req, res, next) => {
  const sessionToken = req.headers.authorization?.split("Bearer ")[1];

  if (!sessionToken) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(sessionToken);

    if (error || !user) {
      return res.status(401).json({ error: "Invalid session" });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

module.exports = authenticate;
