const errorHandler = (err, req, res, next) => {
  console.error("Uncaught Exception:", err);

  if (res.headersSent) {
    return next(err);
  }

  const statusCode = err.statusCode || 500;

  res.status(statusCode).json({
    error: {
      message: err.message || "Internal Server Error",
      stack: err.stack,
    },
  });
};

module.exports = errorHandler;
