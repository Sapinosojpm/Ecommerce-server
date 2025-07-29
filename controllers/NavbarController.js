import NavbarLink from "../models/NavbarModel.js";

// Get all links
export const getNavbarLinks = async (req, res) => {
  try {
    let links = await NavbarLink.find();
    if (links.length === 0) {
      // Insert default links if DB is empty
      const defaultLinks = [
        { name: "Home", path: "/" },
        { name: "Product", path: "/collection" },
        { name: "About", path: "/about" },
        { name: "Contact", path: "/contact" }
      ];
      await NavbarLink.insertMany(defaultLinks.map(link => ({ ...link, enabled: true })));
      links = await NavbarLink.find();
    }
    res.json(links);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch navbar links" });
  }
};

// Toggle link status
export const toggleNavbarLink = async (req, res) => {
  const { id } = req.params;
  try {
    const link = await NavbarLink.findById(id);
    if (!link) return res.status(404).json({ error: "Link not found" });

    link.enabled = !link.enabled;
    await link.save();
    res.json(link);
  } catch (error) {
    res.status(500).json({ error: "Failed to update link" });
  }
};

// Add new link (optional)
export const addNavbarLink = async (req, res) => {
  const { name, path } = req.body;
  try {
    const newLink = new NavbarLink({ name, path });
    await newLink.save();
    res.json(newLink);
  } catch (error) {
    res.status(500).json({ error: "Failed to add navbar link" });
  }
};
