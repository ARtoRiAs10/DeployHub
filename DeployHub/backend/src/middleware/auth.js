const { createClerkClient } = require('@clerk/clerk-sdk-node');
const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'No token provided' });
    const payload = await clerk.verifyToken(token);
    req.auth = { userId: payload.sub };
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
module.exports = { requireAuth };
