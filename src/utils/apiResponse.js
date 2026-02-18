const success = (message, data = {}) => ({
  success: true,
  message,
  ...data,
});

const error = (message, data = {}) => ({
  success: false,
  message,
  ...data,
});

module.exports = { success, error };
