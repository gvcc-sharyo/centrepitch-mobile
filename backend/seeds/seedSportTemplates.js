import mongoose from 'mongoose';
import dotenv from 'dotenv';
import SportTemplate from '../models/SportTemplate.js';
import UserSport from '../models/UserSport.js';
import sportTemplatesData from './sportTemplates.js';

dotenv.config();

const seedSportTemplates = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Clear existing templates
    await SportTemplate.deleteMany({});
    console.log('Cleared existing sport templates');

    let created = 0;
    let skipped = 0;

    for (const template of sportTemplatesData) {
      // Find or create the sport in UserSport
      let sport = await UserSport.findOne({ 
        slug: template.sportSlug 
      });

      if (!sport) {
        // Create the sport if it doesn't exist
        sport = await UserSport.create({
          name: template.sportName,
          slug: template.sportSlug,
          isActive: true
        });
        console.log(`Created sport: ${template.sportName}`);
      }

      // Create the template
      await SportTemplate.create({
        sport: sport._id,
        sportName: template.sportName,
        sportSlug: template.sportSlug,
        category: template.category,
        fields: template.fields,
        isActive: true
      });

      created++;
      console.log(`Created template: ${template.sportName}`);
    }

    console.log(`\n✅ Seeding complete!`);
    console.log(`   Templates created: ${created}`);
    console.log(`   Templates skipped: ${skipped}`);
    console.log(`   Total sports in templates: ${sportTemplatesData.length}`);

    process.exit(0);
  } catch (error) {
    console.error('Seeding error:', error);
    process.exit(1);
  }
};

seedSportTemplates();
