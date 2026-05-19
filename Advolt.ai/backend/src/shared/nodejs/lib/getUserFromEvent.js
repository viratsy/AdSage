/**
 * Extracts authenticated user info from API Gateway event.
 * Cognito authorizer injects claims into requestContext.
 */
exports.getUserFromEvent = (event) => {
  const claims = event?.requestContext?.authorizer?.claims;
  if (!claims) return null;
  return {
    user_id: claims.sub,
    email: claims.email,
  };
};
