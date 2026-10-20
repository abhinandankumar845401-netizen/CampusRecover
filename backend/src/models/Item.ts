
import mongoose, { Schema, Document } from "mongoose";

export interface IItem extends Document {
  title: string;
  description: string;
  category: string;
  status: "lost" | "found" | "claimed";
  location: string;
  date: Date;
  imageUrl?: string;
  createdBy: mongoose.Types.ObjectId;
}

const itemSchema = new Schema<IItem>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    createdBy: {
  type: Schema.Types.ObjectId,
  ref: "User",
  required: true,
},
    description: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ["lost", "found", "claimed"],
      required: true,
      default: "lost",
    },
    location: {
      type: String,
      required: true,
      trim: true,
    },
    date: {
      type: Date,
      required: true,
      default: Date.now,
    },
    imageUrl: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

const Item = mongoose.model<IItem>("Item", itemSchema);

export default Item;
