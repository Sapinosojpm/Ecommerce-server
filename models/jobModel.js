import mongoose from "mongoose";

// Define Job schema
const jobSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  image: { type: String }, // Store image path
});

// Create Job model
const Job = mongoose.model("Job", jobSchema);

export default Job;
