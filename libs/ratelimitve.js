const rateLimit = require("express-rate-limit");

export const rateLimitCheck = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 1, // limit each IP to 1 request per windowMs
  message: "Too many clicks, please try again after a minute",
});
