// const { createClerkClient, verifyToken } = require('@clerk/backend');

// const clerkClient = createClerkClient({
//   secretKey: process.env.CLERK_SECRET_KEY,
// });

// const requireAuth = async (req, res, next) => {
//   try {
//     // 1. Extract the token from the Authorization header
//     const authHeader = req.headers.authorization;
//     const token = authHeader?.split(' ')[1];

//     if (!token) {
//       return res.status(401).json({ error: 'No token provided' });
//     }

//     // 2. Use the standalone verifyToken function
//     // It requires the token and your secret key
//     const decoded = await verifyToken(token, {
//       secretKey: process.env.CLERK_SECRET_KEY,
//       // Leeway handles clock sync issues between Codespaces and Clerk
//       authorizedParties: [process.env.FRONTEND_URL], // Optional: adds security
//     });

//     // 3. Attach the userId (the 'sub' claim) to the request
//     req.auth = { userId: decoded.sub };
    
//     next();
//   } catch (err) {
//     console.error("Clerk Auth Error:", err.message);
//     return res.status(401).json({ 
//       error: 'Invalid or expired token',
//       details: err.message 
//     });
//   }
// };

// module.exports = { requireAuth };

const { createClerkClient, verifyToken } = require('@clerk/backend');

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

const requireAuth = async (req, res, next) => {
  try {
    // 1. Extract the token from the Authorization header
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    // 2. Use the standalone verifyToken function
    const decoded = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY,
      /**
       * Leeway: Adds a 60-second grace period. 
       * Vital for GitHub Codespaces where the system clock might be 
       * slightly out of sync with Clerk's servers.
       */
      leeway: 60,
      // Temporarily disabled for dev to prevent "Authorized Party Mismatch" errors
      // authorizedParties: [process.env.FRONTEND_URL], 
    });

    // 3. Attach the userId (the 'sub' claim) to the request
    req.auth = { userId: decoded.sub };
    
    next();
  } catch (err) {
    /**
     * Detailed logging helps you see if the error is 
     * 'Token is not active yet' or 'Invalid signature'
     */
    console.error("Clerk Auth Error:", err.message);
    return res.status(401).json({ 
      error: 'Invalid or expired token',
      details: err.message 
    });
  }
};

module.exports = { requireAuth };