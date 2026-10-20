import express, { Request, Response, NextFunction } from "express";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { v2 as cloudinary } from "cloudinary";
import jwt from "jsonwebtoken";
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config();

const app = express();

const allowedOrigins = new Set(
  (process.env.CLIENT_ORIGINS || "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Authorization, Content-Type",
    );
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  }

  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Admin Credentials & Secrets
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@zion.local";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "dev-only-change-me";
const JWT_SECRET = process.env.JWT_SECRET || "dev-only-change-this-secret";

// Cloudinary Configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// MongoDB Atlas Mongoose Schema & Model
const MONGODB_URI =
  process.env.MONGODB_URI ||
  // "mongodb+srv://peterotixx_db_user:peterotixx_db_user@cluster0.4sjpe8i.mongodb.net/zionDB?retryWrites=true&w=majority";
  // ||
  "mongodb://localhost:27017/zionDB";

if (process.env.NODE_ENV === "production") {
  const requiredEnvironment = [
    "ADMIN_EMAIL",
    "ADMIN_PASSWORD",
    "JWT_SECRET",
    "MONGODB_URI",
    "CLOUDINARY_CLOUD_NAME",
    "CLOUDINARY_API_KEY",
    "CLOUDINARY_API_SECRET",
  ];
  const missingEnvironment = requiredEnvironment.filter(
    (name) => !process.env[name],
  );
  if (missingEnvironment.length > 0) {
    throw new Error(
      `Missing required server environment variables: ${missingEnvironment.join(", ")}`,
    );
  }
}

const pinSchema = new mongoose.Schema<any>({
  id: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  description: { type: String, default: "" },
  imageUrl: { type: String, required: true },
  cloudinaryPublicId: { type: String, default: "" },
  aspectRatio: { type: String, default: "2/3" },
  category: { type: String, default: "Pry 4" },
  tags: [{ type: String }],
  dominantColor: {
    name: { type: String, default: "Stone" },
    hex: { type: String, default: "#78716C" },
  },
  author: {
    name: { type: String, default: "School Admin" },
    handle: { type: String, default: "@peterotunuya" },
    avatar: {
      type: String,
      default:
        "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=140&q=80",
    },
    role: { type: String, default: "admin" },
  },
  curatedByAdmin: { type: Boolean, default: true },
  savedCount: { type: Number, default: 0 },
  likesCount: { type: Number, default: 0 },
  likedByUser: { type: Boolean, default: false },
  sourceUrl: { type: String, default: "" },
  comments: [
    {
      id: String,
      userName: String,
      userAvatar: String,
      text: String,
      timestamp: String,
    },
  ],
  aiAnalysis: {
    aestheticVibe: String,
    suggestedTags: [String],
    dominantColors: [
      {
        name: String,
        hex: String,
      },
    ],
    recognizedSubjects: [String],
    category: String,
    confidenceScore: Number,
  },
  featured: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

export const PinModel =
  mongoose.models.Pin || mongoose.model<any>("Pin", pinSchema);

// Initial Seed Pins for MongoDB if database is empty
const INITIAL_CURATED_PINS = [
  {
    id: "pin-1",
    title: "Monolithic Travertine Pavilion & Sunken Courtyard",
    description:
      "Warm sunlight washes across raw travertine walls and sculptural lime plaster stairs in this modernist desert residence.",
    imageUrl:
      "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=85",
    aspectRatio: "2/3",
    category: "Architecture & Living",
    tags: [
      "travertine",
      "minimalism",
      "natural light",
      "monolithic",
      "desert architecture",
      "brutalism",
    ],
    dominantColor: { name: "Warm Travertine", hex: "#E4D5C7" },
    author: {
      name: "School Admin",
      handle: "@peterotunuya",
      avatar:
        "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=140&q=80",
      role: "admin",
    },
    curatedByAdmin: true,
    savedCount: 342,
    likesCount: 189,
    likedByUser: false,
    sourceUrl: "https://unsplash.com",
    comments: [
      {
        id: "c-1",
        userName: "Aria Chen",
        userAvatar:
          "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=120&q=80",
        text: "The shadow play across the lime plaster is remarkable.",
        timestamp: "2h ago",
      },
    ],
    aiAnalysis: {
      aestheticVibe: "Warm Brutalist / Modern Monolithic",
      suggestedTags: ["travertine", "minimalism", "earthy", "spatial harmony"],
      dominantColors: [
        { name: "Warm Travertine", hex: "#E4D5C7" },
        { name: "Deep Umber", hex: "#583D28" },
        { name: "Raw Sand", hex: "#C2B09A" },
        { name: "Sunlight Gold", hex: "#F3E8D8" },
      ],
      recognizedSubjects: [
        "Travertine wall",
        "Limewash stairway",
        "Sunlit courtyard",
      ],
      category: "Architecture & Living",
    },
  },
  {
    id: "pin-2",
    title: "Japandi Lounge with Floating Hinoki Wood & Wabi-Sabi Ceramics",
    description:
      "A masterclass in restraint: textured unglazed earthenware resting on natural oak flooring alongside filtered shoji illumination.",
    imageUrl:
      "https://images.unsplash.com/photo-1598928506311-c55ded91a20c?auto=format&fit=crop&w=1200&q=85",
    aspectRatio: "3/4",
    category: "Interior & Furniture",
    tags: [
      "japandi",
      "wabi sabi",
      "hinoki",
      "minimal interior",
      "earthy ceramic",
      "warm light",
    ],
    dominantColor: { name: "Raw Oatmeal", hex: "#EAE1D2" },
    author: {
      name: "School Admin",
      handle: "@peterotunuya",
      avatar:
        "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=140&q=80",
      role: "admin",
    },
    curatedByAdmin: true,
    savedCount: 512,
    likesCount: 294,
    likedByUser: false,
    sourceUrl: "https://unsplash.com",
    comments: [],
    aiAnalysis: {
      aestheticVibe: "Japandi Quiet Luxury",
      suggestedTags: [
        "neutral tone",
        "wabi sabi",
        "oak woodwork",
        "ceramic vessel",
      ],
      dominantColors: [
        { name: "Raw Oatmeal", hex: "#EAE1D2" },
        { name: "Warm Charcoal", hex: "#312F2C" },
        { name: "Olive Gray", hex: "#6D7164" },
      ],
      recognizedSubjects: [
        "Shoji light",
        "Earthenware vase",
        "Low-profile seating",
      ],
      category: "Interior & Furniture",
    },
  },
  {
    id: "pin-3",
    title: "Swiss International Typographic Poster & Swiss Grid",
    description:
      "Helvetica typography contrasted against bold geometric vermilion diagonals and generous negative margins.",
    imageUrl:
      "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=1200&q=85",
    aspectRatio: "2/3",
    category: "Graphic Design & Typography",
    tags: [
      "swiss design",
      "helvetica",
      "grid system",
      "poster design",
      "graphic design",
      "minimalist print",
    ],
    dominantColor: { name: "Vermilion Red", hex: "#E6392F" },
    author: {
      name: "School Admin",
      handle: "@peterotunuya",
      avatar:
        "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=140&q=80",
      role: "admin",
    },
    curatedByAdmin: true,
    savedCount: 278,
    likesCount: 156,
    likedByUser: false,
    sourceUrl: "https://unsplash.com",
    comments: [],
    aiAnalysis: {
      aestheticVibe: "Bauhaus / Swiss Style",
      suggestedTags: ["typography", "vermilion", "geometric grid"],
      dominantColors: [
        { name: "Vermilion Red", hex: "#E6392F" },
        { name: "Pure White", hex: "#FFFFFF" },
        { name: "Ink Black", hex: "#111111" },
      ],
      recognizedSubjects: [
        "Editorial typography",
        "Geometric grid",
        "High-contrast poster",
      ],
      category: "Graphic Design & Typography",
    },
  },
  {
    id: "pin-4",
    title: "Kinetic High Fashion Editorial in Draped Linen",
    description:
      "Sculptural silhouettes photographed under soft natural skylight with monochrome tonal drapery and fluid form.",
    imageUrl:
      "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1200&q=85",
    aspectRatio: "2/3",
    category: "Fashion & Editorial",
    tags: [
      "editorial fashion",
      "draped linen",
      "haute couture",
      "tonal styling",
      "fluid silhouette",
    ],
    dominantColor: { name: "Sand Khaki", hex: "#D2C3B2" },
    author: {
      name: "School Admin",
      handle: "@peterotunuya",
      avatar:
        "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=140&q=80",
      role: "admin",
    },
    curatedByAdmin: true,
    savedCount: 420,
    likesCount: 215,
    likedByUser: false,
    sourceUrl: "https://unsplash.com",
    comments: [],
    aiAnalysis: {
      aestheticVibe: "Avant-Garde High Fashion",
      suggestedTags: ["editorial", "fluid fabric", "earth tones"],
      dominantColors: [
        { name: "Sand Khaki", hex: "#D2C3B2" },
        { name: "Warm Black", hex: "#1D1C1B" },
        { name: "Alabaster", hex: "#F7F4F0" },
      ],
      recognizedSubjects: [
        "Editorial model",
        "Linen garment",
        "Monochrome studio",
      ],
      category: "Fashion & Editorial",
    },
  },
  {
    id: "pin-5",
    title: "Earthy Hand-Thrown Terracotta and Glazed Ceramic Vessels",
    description:
      "Studio still life celebrating natural clay imperfections, tactile ridged textures, and soft raking morning shadows.",
    imageUrl:
      "https://images.unsplash.com/photo-1615529328331-f8917597711f?auto=format&fit=crop&w=1200&q=85",
    aspectRatio: "1/1",
    category: "Product & Industrial Design",
    tags: [
      "ceramics",
      "terracotta",
      "pottery",
      "still life",
      "artisan craft",
      "earthy textures",
    ],
    dominantColor: { name: "Terracotta Rust", hex: "#C46849" },
    author: {
      name: "School Admin",
      handle: "@peterotunuya",
      avatar:
        "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=140&q=80",
      role: "admin",
    },
    curatedByAdmin: true,
    savedCount: 310,
    likesCount: 162,
    likedByUser: false,
    sourceUrl: "https://unsplash.com",
    comments: [],
    aiAnalysis: {
      aestheticVibe: "Artisanal Ceramic Craft",
      suggestedTags: ["terracotta", "studio ceramics", "warm tones"],
      dominantColors: [
        { name: "Terracotta Rust", hex: "#C46849" },
        { name: "Bone White", hex: "#EBE5DC" },
        { name: "Burnt Ochre", hex: "#874223" },
      ],
      recognizedSubjects: ["Ceramic vases", "Terracotta vessel", "Still life"],
      category: "Product & Industrial Design",
    },
  },
  {
    id: "pin-6",
    title: "Nordic Pine Mist & Alpine Mountain Solitude",
    description:
      "Dense coniferous forests enveloped in rolling morning fog with layers of atmospheric blue-green depth.",
    imageUrl:
      "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=85",
    aspectRatio: "16/9",
    category: "Nature & Travel",
    tags: [
      "nordic nature",
      "pine forest",
      "misty mountains",
      "atmospheric depth",
      "landscape photography",
    ],
    dominantColor: { name: "Forest Evergreen", hex: "#3B5349" },
    author: {
      name: "School Admin",
      handle: "@peterotunuya",
      avatar:
        "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=140&q=80",
      role: "admin",
    },
    curatedByAdmin: true,
    savedCount: 630,
    likesCount: 388,
    likedByUser: false,
    sourceUrl: "https://unsplash.com",
    comments: [],
    aiAnalysis: {
      aestheticVibe: "Nordic Atmospheric Landscape",
      suggestedTags: ["fog", "evergreen forest", "mountain lake"],
      dominantColors: [
        { name: "Forest Evergreen", hex: "#3B5349" },
        { name: "Misty Sage", hex: "#7D958B" },
        { name: "Slate Teal", hex: "#233734" },
      ],
      recognizedSubjects: [
        "Alpine lake",
        "Mist-covered pines",
        "Mountain reflections",
      ],
      category: "Nature & Travel",
    },
  },
  {
    id: "pin-7",
    title: "Raw Concrete Cantilever & Geometric Skylight Rhythm",
    description:
      "Intense geometric sunlight cuts diagonal rhythms across cast concrete surfaces in this contemporary museum wing.",
    imageUrl:
      "https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1200&q=85",
    aspectRatio: "3/4",
    category: "Architecture & Living",
    tags: [
      "brutalism",
      "concrete",
      "skylight",
      "light and shadow",
      "modernist museum",
      "minimalist",
    ],
    dominantColor: { name: "Cast Concrete", hex: "#949599" },
    author: {
      name: "School Admin",
      handle: "@peterotunuya",
      avatar:
        "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=140&q=80",
      role: "admin",
    },
    curatedByAdmin: true,
    savedCount: 489,
    likesCount: 275,
    likedByUser: false,
    sourceUrl: "https://unsplash.com",
    comments: [],
    aiAnalysis: {
      aestheticVibe: "Geometric Brutalism",
      suggestedTags: ["concrete", "geometric architecture", "high contrast"],
      dominantColors: [
        { name: "Cast Concrete", hex: "#949599" },
        { name: "Bright Daylight", hex: "#F0F1F4" },
        { name: "Shadow Charcoal", hex: "#2D2E30" },
      ],
      recognizedSubjects: [
        "Concrete cantilever",
        "Geometric skylight",
        "Linear staircase",
      ],
      category: "Architecture & Living",
    },
  },
  {
    id: "pin-8",
    title: "Mid-Century Teak Credenza with Matte Brass Finishes",
    description:
      "Warm wood grain tones complemented by tactile brass hardware, sculptural task lamp, and linen textile backdrop.",
    imageUrl:
      "https://images.unsplash.com/photo-1538688525198-9b88f6f53126?auto=format&fit=crop&w=1200&q=85",
    aspectRatio: "2/3",
    category: "Interior & Furniture",
    tags: [
      "mid century modern",
      "teak furniture",
      "brass accents",
      "warm interior",
      "scandinavian decor",
    ],
    dominantColor: { name: "Warm Teak", hex: "#A86C43" },
    author: {
      name: "School Admin",
      handle: "@peterotunuya",
      avatar:
        "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=140&q=80",
      role: "admin",
    },
    curatedByAdmin: true,
    savedCount: 380,
    likesCount: 204,
    likedByUser: false,
    sourceUrl: "https://unsplash.com",
    comments: [],
    aiAnalysis: {
      aestheticVibe: "Mid-Century Modern Warmth",
      suggestedTags: ["teak", "brass fixture", "warm living"],
      dominantColors: [
        { name: "Warm Teak", hex: "#A86C43" },
        { name: "Matte Brass", hex: "#D1AC68" },
        { name: "Oatmeal Wall", hex: "#EDE7DC" },
      ],
      recognizedSubjects: ["Teak sideboard", "Brass lamp", "Framed art print"],
      category: "Interior & Furniture",
    },
  },
];

// Seed function
async function seedInitialPinsIfEmpty() {
  try {
    const count = await PinModel.countDocuments();
    if (count === 0) {
      console.log("Seeding initial curated pins to MongoDB...");
      await PinModel.insertMany(INITIAL_CURATED_PINS);
      console.log(
        `Seeded ${INITIAL_CURATED_PINS.length} pins successfully into MongoDB Atlas!`,
      );
    } else {
      console.log(`MongoDB already contains ${count} pins.`);
    }
  } catch (err: any) {
    console.error("Error seeding initial pins:", err.message);
  }
}

// Connect to MongoDB
mongoose
  .connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 8000,
  })
  .then(async () => {
    console.log(
      "Connected to MongoDB Atlas database: cluster0.4sjpe8i.mongodb.net",
    );
    await seedInitialPinsIfEmpty();
  })
  .catch((err) => {
    console.warn("MongoDB Atlas connection notice:", err.message);
  });

function getCloudinaryPublicId(
  pin: { cloudinaryPublicId?: string; imageUrl?: string } | null | undefined,
) {
  if (!pin) return null;

  if (pin.cloudinaryPublicId) return pin.cloudinaryPublicId;

  if (!pin.imageUrl) return null;

  try {
    const url = new URL(pin.imageUrl);
    const parts = url.pathname.split("/");
    const uploadIndex = parts.indexOf("upload");
    if (uploadIndex === -1) return null;

    const candidate = parts.slice(uploadIndex + 1).join("/");
    const withoutVersion = candidate.replace(/^v\d+\//, "");
    const clean = withoutVersion.replace(/\.[^/]+$/, "");
    return clean || null;
  } catch {
    return null;
  }
}

async function removePinAsset(
  pin: { cloudinaryPublicId?: string; imageUrl?: string } | null | undefined,
) {
  const publicId = getCloudinaryPublicId(pin);
  if (!publicId) return;

  try {
    await cloudinary.uploader.destroy(publicId);
    console.log(`Deleted Cloudinary asset: ${publicId}`);
  } catch (err) {
    console.warn("Could not delete Cloudinary asset:", err);
  }
}
// Auth Middleware: Verify Admin JWT Token
const verifyAdmin = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ error: "Unauthorized: Admin authentication token required" });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    if (
      decoded.role !== "admin" ||
      decoded.email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()
    ) {
      return res
        .status(403)
        .json({ error: "Forbidden: Admin curation access only" });
    }
    (req as any).user = decoded;
    next();
  } catch {
    return res
      .status(401)
      .json({ error: "Invalid or expired authentication token" });
  }
};

// Initialize GoogleGenAI SDK according to gemini-api skill guidelines
const apiKey = process.env.GEMINI_API_KEY || "";
const ai = apiKey
  ? new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    })
  : null;

// ==========================================
// 1. AUTHENTICATION ENDPOINTS (ADMIN ONLY)
// ==========================================

app.get("/api/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    database:
      mongoose.connection.readyState === 1 ? "connected" : "disconnected",
  });
});

// Endpoint: Admin Login
app.post("/api/auth/login", (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  if (
    email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase() &&
    password.trim() === ADMIN_PASSWORD
  ) {
    const token = jwt.sign(
      {
        email: ADMIN_EMAIL,
        name: "School Admin",
        role: "admin",
      },
      JWT_SECRET,
      { expiresIn: "30d" },
    );

    return res.json({
      user: {
        id: "admin-peter",
        name: "School Admin",
        email: ADMIN_EMAIL,
        role: "admin",
        avatar:
          "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=140&q=80",
        token,
      },
    });
  }

  return res.status(401).json({ error: "Invalid admin email or password" });
});

// Endpoint: Current Session Verification
app.get("/api/auth/me", (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No active session" });
  }
  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    return res.json({
      user: {
        id: "admin-peter",
        name: decoded.name || "School Admin",
        email: decoded.email,
        role: decoded.role,
        avatar:
          "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=140&q=80",
        token,
      },
    });
  } catch {
    return res.status(401).json({ error: "Session expired" });
  }
});

// ==========================================
// 2. CLOUDINARY UPLOAD ENDPOINT
// ==========================================

// Endpoint: Upload image to Cloudinary (Protected: Admin Only)
app.post("/api/upload", verifyAdmin, async (req: Request, res: Response) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        error:
          "The image library database is unavailable. Nothing was uploaded.",
      });
    }

    const {
      imageBase64,
      title,
      description,
      category,
      tags,
      aspectRatio,
      dominantColor,
    } = req.body;
    if (!imageBase64) {
      return res
        .status(400)
        .json({ error: "imageBase64 data string is required" });
    }

    console.log("Uploading image to Cloudinary (folder: pinspire_pins)...");
    const metadata = {
      title,
      description,
      category,
      tags,
      aspectRatio,
      dominantColor,
    };
    const result = await cloudinary.uploader.upload(imageBase64, {
      folder: "pinspire_pins",
      resource_type: "image",
      context: `Tos School=${Buffer.from(JSON.stringify(metadata)).toString("base64url")}`,
    });

    console.log("Cloudinary upload success! URL:", result.secure_url);
    return res.json({
      url: result.secure_url,
      publicId: result.public_id,
      width: result.width,
      height: result.height,
      format: result.format,
    });
  } catch (err: any) {
    console.error("Cloudinary upload error:", err);
    return res.status(500).json({
      error: "Failed to upload image to Cloudinary",
      details: err?.message || String(err),
    });
  }
});

// ==========================================
// 3. MONGODB PINS CRUD ENDPOINTS
// ==========================================

app.get("/api/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    database:
      mongoose.connection.readyState === 1 ? "connected" : "disconnected",
  });
});

// Endpoint: Get all pins from MongoDB
app.get("/api/pins", async (_req: Request, res: Response) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      error: "The image library database is unavailable.",
    });
  }

  try {
    const mongoPins = await PinModel.find().sort({ createdAt: -1 }).lean();
    return res.json(mongoPins);
  } catch (err: any) {
    console.error("Error fetching pins from MongoDB:", err);
    return res.status(503).json({
      error: "Could not load the image library from the database.",
    });
  }
});

// Endpoint: Create a new Pin in MongoDB (Protected: Admin Only)
app.post("/api/pins", verifyAdmin, async (req: Request, res: Response) => {
  const pinData = req.body;
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      error:
        "The image library database is unavailable. The image was not published.",
    });
  }

  try {
    const pinId = pinData.id || `pin-${Date.now()}`;

    const newPin = new PinModel({
      ...pinData,
      id: pinId,
      curatedByAdmin: true,
      author: {
        name: "School Admin",
        handle: "@peterotunuya",
        avatar:
          "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=140&q=80",
        role: "admin",
      },
      createdAt: new Date(),
    });

    await newPin.save();
    console.log(`Pin saved to MongoDB: "${newPin.title}" (${pinId})`);

    return res.status(201).json(newPin);
  } catch (err: any) {
    console.error("Error saving pin to MongoDB:", err);
    await removePinAsset(pinData);
    return res.status(500).json({
      error: "Failed to save pin to database",
      details: err?.message || String(err),
    });
  }
});

// Endpoint: Delete a Pin (Protected: Admin Only)
app.delete(
  "/api/pins/:id",
  verifyAdmin,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      if (mongoose.connection.readyState !== 1) {
        return res.status(503).json({
          error:
            "Image library storage is unavailable. The pin was not deleted.",
        });
      }

      const pin = await PinModel.findOne({ id });
      await removePinAsset(pin);
      await PinModel.deleteOne({ id });

      return res.json({ success: true, message: "Pin deleted successfully" });
    } catch (err: any) {
      return res
        .status(500)
        .json({ error: "Failed to delete pin", details: err?.message });
    }
  },
);

// Endpoint: Toggle like on a pin
app.post("/api/pins/:id/like", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { liked } = req.body;
    if (mongoose.connection.readyState === 1) {
      const pin = await PinModel.findOne({ id });
      if (pin) {
        pin.likesCount = Math.max(0, pin.likesCount + (liked ? 1 : -1));
        await pin.save();
        return res.json({ success: true, likesCount: pin.likesCount });
      }
    }
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to update like status" });
  }
});

// Endpoint: Add comment to a pin
app.post("/api/pins/:id/comment", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { text, userName, userAvatar } = req.body;
    if (!text)
      return res.status(400).json({ error: "Comment text is required" });

    const newComment = {
      id: `c-${Date.now()}`,
      userName: userName || "Visitor",
      userAvatar:
        userAvatar ||
        "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80",
      text,
      timestamp: "Just now",
    };

    if (mongoose.connection.readyState === 1) {
      const pin = await PinModel.findOne({ id });
      if (pin) {
        pin.comments.push(newComment);
        await pin.save();
        return res.status(201).json(newComment);
      }
    }
    return res.status(201).json(newComment);
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to post comment" });
  }
});

// ==========================================
// 4. GEMINI AI VISION & SEARCH ENDPOINTS
// ==========================================

// Endpoint: AI Image Recognition & Auto-Tagging
app.post("/api/ai/analyze-image", async (req: Request, res: Response) => {
  try {
    const {
      imageBase64,
      mimeType = "image/jpeg",
      imageUrl,
      promptContext,
    } = req.body;

    if (!imageBase64 && !imageUrl) {
      return res
        .status(400)
        .json({ error: "Either imageBase64 or imageUrl is required" });
    }

    if (!ai) {
      return res.json({
        title: "Minimalist Architectural Form & Light",
        description:
          "A curated visual exploration emphasizing balanced geometry, tactile materials, and organic natural lighting.",
        suggestedTags: [
          "minimalism",
          "natural light",
          "modern architecture",
          "warm tone",
          "spatial design",
          "editorial",
        ],
        category: "Architecture & Living",
        dominantColors: [
          { name: "Warm Sand", hex: "#E2D4C3" },
          { name: "Oatmeal", hex: "#F4EFEA" },
          { name: "Raw Umber", hex: "#634832" },
          { name: "Charcoal", hex: "#2A2927" },
        ],
        aestheticVibe: "Warm Minimalist / Quiet Luxury",
        recognizedSubjects: [
          "Sculptural space",
          "Interior sunlight",
          "Limewash texture",
        ],
        aspectRatio: "2/3",
      });
    }

    let contentsParts: any[] = [];

    if (imageBase64) {
      const cleanBase64 = imageBase64.replace(
        /^data:image\/[a-z]+;base64,/,
        "",
      );
      contentsParts.push({
        inlineData: {
          mimeType,
          data: cleanBase64,
        },
      });
    }

    const promptText = `
You are an expert educational curator and curriculum visual specialist for Tos School (Nigerian Curriculum Visual Study & Teaching Aid Hub covering Pry 4 to SSS 3).
Analyze this visual study image thoroughly.
Identify the subject matter (e.g. Biology, Mathematics, Physics, Chemistry, Geography, Basic Science, Agricultural Science, Anatomy, Geometry), educational level, key concepts, and color harmony.
${promptContext ? `Additional context: ${promptContext}` : ""}

Return a valid JSON object matching this schema:
{
  "title": "A clear, descriptive educational title (max 7 words)",
  "description": "A compelling 2-sentence educational summary explaining the diagram, chart, or concept depicted.",
  "suggestedTags": ["6-10 specific subject, topic, and concept tags in lowercase"],
  "category": "Pick the best matching school class level from: 'Pry 4', 'Pry 5', 'Pry 6', 'JSS 1', 'JSS 2', 'JSS 3', 'SSS 1', 'SSS 2', 'SSS 3'",
  "dominantColors": [
    {"name": "Color name", "hex": "#HEX"}
  ],
  "aestheticVibe": "e.g., Illustrated Diagram, Science Infographic, Geometric Proof, Leaf Anatomy, Solar Chart",
  "recognizedSubjects": ["3-5 primary recognizable subjects or educational concepts"],
  "aspectRatio": "recommended aspect ratio: '2/3', '1/1', '3/4', '16/9', or '9/16'"
}`;

    contentsParts.push({ text: promptText });

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: { parts: contentsParts },
      config: {
        responseMimeType: "application/json",
      },
    });

    const rawText = response.text || "{}";
    const parsed = JSON.parse(rawText);
    return res.json(parsed);
  } catch (error: any) {
    console.error("Error analyzing image with Gemini:", error);
    return res.status(500).json({
      error: "Failed to analyze image",
      details: error?.message || String(error),
    });
  }
});

// Endpoint: AI Smart Search Tag Suggestions
app.post("/api/ai/suggest-tags", async (req: Request, res: Response) => {
  try {
    const { query, activeCategory } = req.body;

    if (!query && !activeCategory) {
      return res.json({
        suggestions: [
          "mid-century modern teak",
          "brutalist concrete architecture",
          "editorial high fashion lookbook",
          "japandi living room neutral",
          "swiss graphic design typography",
          "terracotta ceramic pottery",
          "scandinavian warm lighting",
          "biophilic interior greenery",
        ],
      });
    }

    if (!ai) {
      const genericSuggestions = [
        "Pry 4 Solar System & Plant Anatomy",
        "Pry 5 Fractions & Water Cycle",
        "Pry 6 Human Anatomy & Systems",
        "JSS 1 Algebra & Basic Science",
        "JSS 2 Periodic Table & Atoms",
        "JSS 3 Pythagoras & Linear Equations",
        "SSS 1 Newtonian Physics & Mechanics",
        "SSS 2 Electromagnetism & Genetics",
        "SSS 3 Organic Chemistry & Calculus",
      ];
      return res.json({ suggestions: genericSuggestions });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: `Generate 7 highly relevant educational and visual learning search tags or topics based on the user query "${query || ""}" ${
        activeCategory ? `for school class level "${activeCategory}"` : ""
      }.
Focus on school subjects in curriculum classes: Pry 4, Pry 5, Pry 6, JSS 1, JSS 2, JSS 3, SSS 1, SSS 2, SSS 3 (e.g. Science, Mathematics, Biology, Physics, Chemistry, Geography).
Return ONLY a JSON array of strings, e.g. ["Pry 4 Fractions", "JSS 1 Basic Science", "SSS 2 Chemistry"].`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
      },
    });

    const parsed = JSON.parse(response.text || "[]");
    return res.json({ suggestions: parsed });
  } catch (error: any) {
    console.error("Error in tag suggestions:", error);
    return res.json({
      suggestions: [
        "Pry 4 Mathematics",
        "JSS 1 Basic Science",
        "JSS 2 Chemistry",
        "SSS 1 Physics",
        "SSS 3 Organic Chemistry",
      ],
    });
  }
});

// Endpoint: AI Visual Search / Similar Pins Matching
app.post("/api/ai/visual-search", async (req: Request, res: Response) => {
  try {
    const { imageBase64, query, pinCandidates } = req.body;

    if (!ai) {
      const lower = (query || "").toLowerCase();
      const matched = (pinCandidates || []).filter(
        (p: any) =>
          p.title.toLowerCase().includes(lower) ||
          p.category.toLowerCase().includes(lower) ||
          p.tags.some((t: string) => t.toLowerCase().includes(lower)),
      );
      return res.json({
        matchedPinIds: matched.slice(0, 10).map((p: any) => p.id),
        visualAesthetic: "Contemporary Visual Harmony",
        keyFeatures: [
          "Geometric structure",
          "Neutral palette",
          "Balanced light",
        ],
      });
    }

    let contentsParts: any[] = [];
    if (imageBase64) {
      const cleanBase64 = imageBase64.replace(
        /^data:image\/[a-z]+;base64,/,
        "",
      );
      contentsParts.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: cleanBase64,
        },
      });
    }

    const candidateSummary = (pinCandidates || []).map((p: any) => ({
      id: p.id,
      title: p.title,
      category: p.category,
      tags: p.tags,
      dominantColor: p.dominantColor?.name,
    }));

    contentsParts.push({
      text: `Analyze the visual style and content of the query ${query ? `(user query: "${query}")` : ""}.
Rank the most visually and stylistically similar pins from this available pin catalog:
${JSON.stringify(candidateSummary.slice(0, 30))}

Return a JSON object:
{
  "matchedPinIds": ["list of matching pin ids in order of relevance, top 6-12 items"],
  "visualAesthetic": "short aesthetic summary of the query image or vibe",
  "keyFeatures": ["3 distinctive visual features detected"],
  "matchReasoning": "1 sentence why these pins match the aesthetic"
}`,
    });

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: { parts: contentsParts },
      config: {
        responseMimeType: "application/json",
      },
    });

    const result = JSON.parse(response.text || "{}");
    return res.json(result);
  } catch (error: any) {
    console.error("Error in visual search:", error);
    return res
      .status(500)
      .json({ error: "Visual search failed", details: error?.message });
  }
});

const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Tos School API server listening on port ${PORT}`);
});
