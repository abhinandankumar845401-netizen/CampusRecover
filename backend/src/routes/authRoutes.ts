import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/user.js";
const router = Router();

// Generate JWT token
const generateToken = (userId: string): string => {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is missing from .env");
  }

  return jwt.sign(
    { userId },
    secret,
    { expiresIn: "1d" }
  );
};

// ================================
// REGISTER
// POST /api/auth/register
// ================================
router.post(
  "/register",
  async (req: Request, res: Response) => {
    try {
      const { name, email, password } = req.body;

      // Validate input
      if (
        typeof name !== "string" ||
        typeof email !== "string" ||
        typeof password !== "string" ||
        !name.trim() ||
        !email.trim() ||
        !password
      ) {
        return res.status(400).json({
          success: false,
          message: "Name, email, and password are required.",
        });
      }

      if (password.length < 8) {
        return res.status(400).json({
          success: false,
          message: "Password must be at least 8 characters long.",
        });
      }

      const normalizedEmail = email.trim().toLowerCase();

      // Check if email already exists
      const existingUser = await User.findOne({
        email: normalizedEmail,
      });

      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: "Email is already registered.",
        });
      }

      // Hash password before saving
      const hashedPassword = await bcrypt.hash(password, 12);

      const user = await User.create({
        name: name.trim(),
        email: normalizedEmail,
        password: hashedPassword,
      });

      const token = generateToken(user._id.toString());

      return res.status(201).json({
        success: true,
        message: "Registration successful.",
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
        },
      });
    } catch (error) {
      // Handle duplicate email registration
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === 11000
      ) {
        return res.status(409).json({
          success: false,
          message: "Email is already registered.",
        });
      }

      console.error("Registration error:", error);

      return res.status(500).json({
        success: false,
        message: "Unable to register user.",
      });
    }
  }
);

// ================================
// LOGIN
// POST /api/auth/login
// ================================
router.post(
  "/login",
  async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;

      if (
        typeof email !== "string" ||
        typeof password !== "string" ||
        !email.trim() ||
        !password
      ) {
        return res.status(400).json({
          success: false,
          message: "Email and password are required.",
        });
      }

      // Password is select:false in user.ts,
      // so explicitly retrieve it for comparison.
      const user = await User.findOne({
        email: email.trim().toLowerCase(),
      }).select("+password");

      if (!user) {
        return res.status(401).json({
          success: false,
          message: "Invalid email or password.",
        });
      }

      // Compare entered password with stored hash
      const passwordMatches = await bcrypt.compare(
        password,
        user.password
      );

      if (!passwordMatches) {
        return res.status(401).json({
          success: false,
          message: "Invalid email or password.",
        });
      }

      const token = generateToken(user._id.toString());

      return res.status(200).json({
        success: true,
        message: "Login successful.",
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
        },
      });
    } catch (error) {
      console.error("Login error:", error);

      return res.status(500).json({
        success: false,
        message: "Unable to log in.",
      });
    }
  }
);

export default router;
