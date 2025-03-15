const Hero = require('./models/heroModel.js');

const createHero = async () => {
  const hero = new Hero({
    title: 'Machines: The Farmer’s Best Friend',
    subtitle: 'The future of farming is automated.',
    image: 'https://example.com/hero-background.jpg',
  });

  await hero.save();
  console.log('Hero section saved:', hero);
};

createHero();

const fetchHero = async () => {
    const hero = await Hero.findOne(); // Get the first document
    console.log('Hero section:', hero);
  };
  
  fetchHero();
  
  const updateHero = async () => {
    const updatedHero = await Hero.findOneAndUpdate(
      {},
      {
        title: 'Updated Title',
        subtitle: 'Updated Subtitle',
        image: 'https://example.com/new-image.jpg',
      },
      { new: true, upsert: true } // Return the updated document and create it if not found
    );
    console.log('Updated Hero:', updatedHero);
  };
  
  updateHero();
  
  const deleteHero = async () => {
    await Hero.deleteMany(); // Deletes all hero documents
    console.log('Hero section deleted');
  };
  
  deleteHero();
  

  