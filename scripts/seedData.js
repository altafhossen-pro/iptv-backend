// scripts/seedData.js
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

// Load environment variables
dotenv.config();

// Import models
const Category = require('../src/models/Category');
const Channel = require('../src/models/Channel');

// Connect to MongoDB
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/iptv');
        console.log('✅ MongoDB connected successfully');
    } catch (error) {
        console.error('❌ MongoDB connection error:', error);
        process.exit(1);
    }
};

// Read channels JSON file
const readChannelsData = () => {
    try {
        const filePath = path.join(__dirname, '../channels.json');
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('❌ Error reading channels.json:', error);
        process.exit(1);
    }
};

// Reset database (optional)
const resetDatabase = async () => {
    try {
        console.log('🗑️  Resetting database...');
        await Channel.deleteMany({});
        await Category.deleteMany({});
        console.log('✅ Database reset completed');
    } catch (error) {
        console.error('❌ Error resetting database:', error);
        throw error;
    }
};

// Create categories from channel data
const createCategories = async (channelsData) => {
    const categories = [];
    const categoryMap = new Map();

    // Extract unique categories from channels
    Object.values(channelsData.channels).forEach(categoryChannels => {
        categoryChannels.forEach(channel => {
            if (!categoryMap.has(channel.category)) {
                categoryMap.set(channel.category, {
                    name: channel.category,
                    slug: channel.category.toLowerCase().replace(/\s+/g, '-'),
                    description: `${channel.category} channels`,
                    icon: getCategoryIcon(channel.category),
                    sort_order: getCategorySortOrder(channel.category),
                    status: 'active'
                });
            }
        });
    });

    // Create categories in database
    for (const [categoryName, categoryData] of categoryMap) {
        try {
            // Check if category already exists
            let category = await Category.findOne({ slug: categoryData.slug });
            
            if (!category) {
                category = new Category(categoryData);
                await category.save();
                console.log(`✅ Created category: ${categoryName}`);
            } else {
                console.log(`ℹ️  Category already exists: ${categoryName}`);
            }
            
            categories.push(category);
        } catch (error) {
            console.error(`❌ Error creating category ${categoryName}:`, error);
        }
    }

    return categories;
};

// Get category icon based on category name
const getCategoryIcon = (categoryName) => {
    const iconMap = {
        'Sports': 'sports-soccer',
        'Bangladesh': 'flag',
        'Indian Bangla': 'tv',
        'Music': 'music-note',
        'Kids': 'child-care',
        'News': 'newspaper',
        'Infotainment': 'nature',
        'Movies': 'movie',
        'Documentary': 'school'
    };
    return iconMap[categoryName] || 'tv';
};

// Get category sort order
const getCategorySortOrder = (categoryName) => {
    const orderMap = {
        'Bangladesh': 1,
        'Indian Bangla': 2,
        'Sports': 3,
        'Movies': 4,
        'Music': 5,
        'News': 6,
        'Kids': 7,
        'Infotainment': 8,
        'Documentary': 9
    };
    return orderMap[categoryName] || 10;
};

// Create channels from data
const createChannels = async (channelsData, categories) => {
    const categoryMap = new Map();
    categories.forEach(cat => {
        categoryMap.set(cat.name, cat._id);
    });

    let totalChannels = 0;
    let createdChannels = 0;
    let skippedChannels = 0;

    for (const [categoryKey, channels] of Object.entries(channelsData.channels)) {
        console.log(`\n📺 Processing ${categoryKey} channels...`);
        
        for (const channelData of channels) {
            totalChannels++;
            
            try {
                // Check if channel already exists
                const existingChannel = await Channel.findOne({ 
                    name: { $regex: new RegExp('^' + channelData.name + '$', 'i') }
                });

                if (existingChannel) {
                    console.log(`ℹ️  Channel already exists: ${channelData.name}`);
                    skippedChannels++;
                    continue;
                }

                // Get category ID
                const categoryId = categoryMap.get(channelData.category);
                if (!categoryId) {
                    console.log(`⚠️  Category not found for channel ${channelData.name}: ${channelData.category}`);
                    skippedChannels++;
                    continue;
                }

                // Create channel object
                const channel = new Channel({
                    name: channelData.name,
                    description: `${channelData.name} - ${channelData.category} channel`,
                    category_id: categoryId,
                    m3u8_url: channelData.url,
                    logo: channelData.logo,
                    thumbnail: channelData.logo,
                    is_premium: isPremiumChannel(channelData.name, channelData.category),
                    quality: getChannelQuality(channelData.name),
                    language: getChannelLanguage(channelData.category),
                    country: getChannelCountry(channelData.category),
                    sort_order: Math.floor(Math.random() * 100),
                    status: 'active',
                    is_online: true,
                    viewer_count: Math.floor(Math.random() * 1000)
                });

                // The encrypted_url will be automatically generated by the pre-save middleware

                await channel.save();
                createdChannels++;
                console.log(`✅ Created channel: ${channelData.name}`);
                
            } catch (error) {
                console.error(`❌ Error creating channel ${channelData.name}:`, error);
                skippedChannels++;
            }
        }
    }

    return { totalChannels, createdChannels, skippedChannels };
};

// Determine if channel is premium
const isPremiumChannel = (channelName, category) => {
    const premiumKeywords = ['hd', 'premium', 'plus', 'gold', 'select'];
    const premiumChannels = [
        'Star Sports 1 Hindi',
        'Star Sports 2 HD',
        'Star Sports Select 1 HD',
        'Sony Sports 1 HD',
        'Sony Sports 2 HD',
        'Sony Sports 3 HD',
        'Sony Sports 4 HD',
        'Sony Sports 5 HD',
        'Star Jalsha HD',
        'Zee Bangla HD',
        'Colors Bangla HD',
        'Aaj Tak HD',
        'News 24 HD'
    ];

    const nameLower = channelName.toLowerCase();
    const hasPremiumKeyword = premiumKeywords.some(keyword => nameLower.includes(keyword));
    const isPremiumChannel = premiumChannels.includes(channelName);

    return hasPremiumKeyword || isPremiumChannel || category === 'Movies';
};

// Get channel quality
const getChannelQuality = (channelName) => {
    const nameLower = channelName.toLowerCase();
    if (nameLower.includes('hd')) return 'HD';
    if (nameLower.includes('4k')) return '4K';
    return 'SD';
};

// Get channel language
const getChannelLanguage = (category) => {
    if (category === 'Bangladesh' || category === 'Indian Bangla') return 'Bangla';
    if (category === 'News' && category.includes('English')) return 'English';
    return 'Other';
};

// Get channel country
const getChannelCountry = (category) => {
    if (category === 'Bangladesh') return 'Bangladesh';
    if (category === 'Indian Bangla') return 'India';
    return 'International';
};

// Main seeding function
const seedData = async () => {
    try {
        console.log('🚀 Starting data seeding...\n');

        // Check if reset flag is provided
        const shouldReset = process.argv.includes('--reset');
        if (shouldReset) {
            await resetDatabase();
        }

        // Read channels data
        const channelsData = readChannelsData();
        console.log(`📊 Found ${Object.keys(channelsData.channels).length} categories in JSON`);

        // Create categories
        console.log('\n📂 Creating categories...');
        const categories = await createCategories(channelsData);
        console.log(`✅ Created ${categories.length} categories`);

        // Create channels
        console.log('\n📺 Creating channels...');
        const { totalChannels, createdChannels, skippedChannels } = await createChannels(channelsData, categories);
        
        console.log('\n🎉 Seeding completed!');
        console.log(`📊 Summary:`);
        console.log(`   - Total channels processed: ${totalChannels}`);
        console.log(`   - New channels created: ${createdChannels}`);
        console.log(`   - Skipped (already exist): ${skippedChannels}`);
        console.log(`   - Categories: ${categories.length}`);

        // Display statistics
        const stats = await getDatabaseStats();
        console.log('\n📈 Database Statistics:');
        console.log(`   - Total channels in DB: ${stats.totalChannels}`);
        console.log(`   - Total categories in DB: ${stats.totalCategories}`);
        console.log(`   - Premium channels: ${stats.premiumChannels}`);
        console.log(`   - Free channels: ${stats.freeChannels}`);

        // Display category breakdown
        console.log('\n📂 Category Breakdown:');
        for (const category of categories) {
            const channelCount = await Channel.countDocuments({ category_id: category._id });
            console.log(`   - ${category.name}: ${channelCount} channels`);
        }

    } catch (error) {
        console.error('❌ Seeding error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from MongoDB');
        process.exit(0);
    }
};

// Get database statistics
const getDatabaseStats = async () => {
    const totalChannels = await Channel.countDocuments();
    const totalCategories = await Category.countDocuments();
    const premiumChannels = await Channel.countDocuments({ is_premium: true });
    const freeChannels = await Channel.countDocuments({ is_premium: false });

    return {
        totalChannels,
        totalCategories,
        premiumChannels,
        freeChannels
    };
};

// Run the seeding
if (require.main === module) {
    connectDB().then(() => {
        seedData();
    });
}

module.exports = { seedData }; 