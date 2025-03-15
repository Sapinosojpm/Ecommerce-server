import HomePage from '../models/homePageModel.js';

// Get homepage settings
export const getHomePageSettings = async (req, res) => {
  try {
    let settings = await HomePage.findOne();
    if (!settings) {
      settings = new HomePage();
      await settings.save();
    }
    res.status(200).json(settings);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching homepage settings', error });
  }
};

// Update homepage settings
export const updateHomePageSettings = async (req, res) => {
  try {
    const { components } = req.body;
    let settings = await HomePage.findOne();

    if (!settings) {
      settings = new HomePage({ components });
    } else {
      settings.components = components;
    }

    await settings.save();
    res.status(200).json(settings);
  } catch (error) {
    res.status(500).json({ message: 'Error updating homepage settings', error });
  }
};
