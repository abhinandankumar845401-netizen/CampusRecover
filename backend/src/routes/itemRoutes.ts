import { Router, Response } from "express";
import Item from "../models/Item.js";
import cloudinary from "../config/cloudinary.js";
import uploadItemImage from "../middleware/uploadMiddleware.js";
import authMiddleware, {
  AuthRequest,
} from "../middleware/authMiddleware.js";
const router = Router();
const uploadToCloudinary = (buffer: Buffer): Promise<string> =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "campusrecover",
        resource_type: "image",
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }

        if (!result) {
          reject(new Error("Cloudinary returned no upload result."));
          return;
        }

        resolve(result.secure_url);
      }
    );

    stream.end(buffer);
  });
// 1. Create a lost/found item report
// 1. Create a lost/found item report
router.post(
  "/",
  authMiddleware,
  uploadItemImage,
  async (req: AuthRequest, res: Response) => {
    try {
      let imageUrl: string | undefined;

      if (req.file) {
        imageUrl = await uploadToCloudinary(req.file.buffer);
      }

      const item = await Item.create({
        ...req.body,
        ...(imageUrl ? { imageUrl } : {}),
        createdBy: req.userId,
      });

      return res.status(201).json({
        success: true,
        message: "Item reported successfully",
        data: item,
      });
    } catch (error) {
      console.error("Create item error:", error);

      return res.status(500).json({
        success: false,
        message: "Could not create item or upload image.",
      });
    }
  }
);

// 2. Get all items (public)
router.get("/", async (_req, res) => {
  try {
    const items = await Item.find().sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: items.length,
      data: items,
    });
  } catch {
    return res.status(500).json({
      success: false,
      message: "Could not fetch items",
    });
  }
});

// 3. Get one item by ID (public)
router.get("/:id", async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Item not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: item,
    });
  } catch {
    return res.status(400).json({
      success: false,
      message: "Invalid item ID",
    });
  }
});

// 4. Update an item's status (owner only)
router.patch(
  "/:id/status",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const { status } = req.body;

      if (!["lost", "found", "claimed"].includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Status must be lost, found, or claimed",
        });
      }

      const item = await Item.findOneAndUpdate(
        {
          _id: req.params.id,
          createdBy: req.userId,
        },
        { status },
        {
          new: true,
          runValidators: true,
        }
      );

      if (!item) {
        return res.status(404).json({
          success: false,
          message: "Item not found",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Item status updated",
        data: item,
      });
    } catch {
      return res.status(400).json({
        success: false,
        message: "Could not update item",
      });
    }
  }
);

// 5. Delete an item (owner only)
router.delete(
  "/:id",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const item = await Item.findOneAndDelete({
        _id: req.params.id,
        createdBy: req.userId,
      });

      if (!item) {
        return res.status(404).json({
          success: false,
          message: "Item not found",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Item deleted successfully",
      });
    } catch {
      return res.status(400).json({
        success: false,
        message: "Invalid item ID",
      });
    }
  }
);

router.get(
  "/mine",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          message: "Please log in to view your reports.",
        });
      }

      const reports = await Item.find({
        createdBy: req.userId,
      }).sort({ createdAt: -1 });

      return res.status(200).json({
        success: true,
        count: reports.length,
        data: reports,
      });
    } catch (error) {
      console.error("Fetch my reports error:", error);

      return res.status(500).json({
        success: false,
        message: "Could not fetch your reports.",
      });
    }
  }
);

export default router;
