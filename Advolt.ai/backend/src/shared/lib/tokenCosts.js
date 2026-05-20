/**
 * Advolt.ai Token Cost Definitions
 * All costs in Advolt tokens.
 */

const TOKEN_COSTS = {
  hook_analysis: 20,
  generate_hooks: 40,
  generate_ctas: 20,
  short_copy: 30,
  long_copy: 50,
  full_analysis: 120, // bundled discount vs 160 individual
};

const FREE_PLAN_LIFETIME_ANALYSES = 1;
const PRO_MONTHLY_TOKENS = 5000;
const PRO_MONTHLY_EXPIRY_DAYS = 30;

/**
 * Calculate total token cost for a set of operations.
 * @param {string[]} operations - array of operation keys
 * @returns {number} total token cost
 */
const calculateCost = (operations) => {
  if (operations.includes('full_analysis')) return TOKEN_COSTS.full_analysis;
  return operations.reduce((sum, op) => sum + (TOKEN_COSTS[op] || 0), 0);
};

/**
 * Get available tokens for a user (monthly first, then purchased).
 * @param {object} user - user record from DynamoDB
 * @returns {{ monthly: number, purchased: number, total: number, monthlyExpired: boolean }}
 */
const getUserTokenBalance = (user) => {
  const now = Date.now();
  const monthlyExpired = !user.monthly_tokens_expiry ||
    new Date(user.monthly_tokens_expiry).getTime() < now;

  const monthly = monthlyExpired ? 0 : (user.monthly_tokens || 0);
  const purchased = user.purchased_tokens || 0;

  return {
    monthly,
    purchased,
    total: monthly + purchased,
    monthlyExpired,
  };
};

module.exports = {
  TOKEN_COSTS,
  FREE_PLAN_LIFETIME_ANALYSES,
  PRO_MONTHLY_TOKENS,
  PRO_MONTHLY_EXPIRY_DAYS,
  calculateCost,
  getUserTokenBalance,
};
