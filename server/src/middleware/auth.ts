import { Request, Response, NextFunction } from 'express';
import JWTUtils, { DecodedToken } from '../utils/jwtUtils';

declare global {
  namespace Express {
    interface Request {
      user?: DecodedToken;
    }
  }
}

const jwtUtils = new JWTUtils();

export const authMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      res.status(401).json({ success: false, error: 'No token provided' });
      return;
    }

    const decoded = jwtUtils.verifyToken(token);

    if (!decoded) {
      res.status(401).json({ success: false, error: 'Invalid token' });
      return;
    }

    req.user = decoded;
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Authentication error'
    });
  }
};