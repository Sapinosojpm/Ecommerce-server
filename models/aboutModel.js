import mongoose from 'mongoose';

const aboutSchema = new mongoose.Schema(
  {
    mainTitle: {
      type: String, // Main heading for the "About Us" section
      required: true,
    },
    image: {
      type: String, // URL for the "About Us" image
    },
    descriptionTitle: {
      type: String,
      default: "Description", // Editable title for the description section
    },
    description: {
      type: String,
      required: true,
    },
    missionTitle: {
      type: String,
      default: "Mission", // Editable title for the mission section
    },
    mission: {
      type: String,
      required: true,
    },
    qualityAssuranceTitle: {
      type: String,
      default: "Quality Assurance", // Editable title for the quality assurance section
    },
    qualityAssurance: {
      type: String,
      required: true,
    },
    convenienceTitle: {
      type: String,
      default: "Convenience", // Editable title for the convenience section
    },
    convenience: {
      type: String,
      required: true,
    },
    customerServiceTitle: {
      type: String,
      default: "Customer Service", // Editable title for the customer service section
    },
    customerService: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt timestamps
  }
);

const About = mongoose.model('About', aboutSchema);

export default About;
