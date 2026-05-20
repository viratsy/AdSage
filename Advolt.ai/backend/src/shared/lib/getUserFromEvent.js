/**
 * Extracts authenticated user info from API Gateway event.
 * Works with both Cognito authorizer and custom Lambda authorizer.
 */
exports.getUserFromEvent = (event) => {
  const ctx = event?.requestContext?.authorizer;
  if (!ctx) return null;

  // Lambda authorizer puts claims directly in context
  const sub = ctx.sub || ctx.claims?.sub;
  const email = ctx.email || ctx.claims?.email;

  if (!sub) return null;
  return { user_id: sub, email: email || '' };
};
