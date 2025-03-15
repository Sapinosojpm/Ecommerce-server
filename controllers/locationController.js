import Location from "../models/locationModel.js";

export const getLocation = async (req, res) => {
  try {
    const location = await Location.findOne();
    res.json(location || { name: "Default Location", latitude: 0, longitude: 0 });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch location" });
  }
};

export const updateLocation = async (req, res) => {
  try {
    const { name, latitude, longitude } = req.body;
    let location = await Location.findOne();

    if (!location) {
      location = new Location({ name, latitude, longitude });
    } else {
      location.name = name;
      location.latitude = latitude;
      location.longitude = longitude;
    }

    await location.save();
    res.json({ message: "Location updated successfully", location });
  } catch (error) {
    res.status(500).json({ error: "Failed to update location" });
  }
};
