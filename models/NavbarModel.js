import mongoose from "mongoose";

const NavbarLinkSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  path: { type: String, required: true },
  enabled: { type: Boolean, default: true },
});

const NavbarLink = mongoose.model("NavbarLink", NavbarLinkSchema);

export default NavbarLink;
