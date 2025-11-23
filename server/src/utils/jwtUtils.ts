// server/src/utils/jwtUtils.ts
import jwt, { Secret, SignOptions } from 'jsonwebtoken';
import { StringValue } from 'ms'; // <-- Import StringValue from 'ms'

export interface TokenPayload {
  userId: string;
  username: string;
}

export interface DecodedToken extends TokenPayload {
  iat: number;
  exp: number;
}

class JWTUtils {
  private secret: Secret;
  private expiresIn: StringValue; // Now correctly typed as StringValue from 'ms'

  constructor(secret?: string) {
    // Cast to Secret as process.env.JWT_SECRET is a string, but Secret is a wider type
    this.secret = (secret || process.env.JWT_SECRET || 'your-secret-key') as Secret;
    this.expiresIn = '7d';
  }

  generateToken(userId: string, username: string): string {
    const payload: TokenPayload = { userId, username };
    const options: SignOptions = {
      expiresIn: this.expiresIn
    };

    return jwt.sign(payload, this.secret, options);
  }

  verifyToken(token: string): DecodedToken | null {
    try {
      return jwt.verify(token, this.secret) as DecodedToken;
    } catch (error) {
      console.error("JWT verification failed:", error); // Log the error for debugging
      return null;
    }
  }

  decodeToken(token: string): DecodedToken | null {
    try {
      return jwt.decode(token) as DecodedToken | null;
    } catch (error) {
      console.error("JWT decode failed:", error); // Log the error for debugging
      return null;
    }
  }
}

export default JWTUtils;