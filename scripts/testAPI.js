// scripts/testAPI.js
const axios = require('axios');

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:8000/api/v1';

// Test API endpoints
const testAPI = async () => {
    console.log('🧪 Testing IPTV API endpoints...\n');

    try {
        // Test health check
        console.log('1️⃣ Testing health check...');
        const healthResponse = await axios.get(`${BASE_URL}/health`);
        console.log('✅ Health check:', healthResponse.data);

        // Test categories
        console.log('\n2️⃣ Testing categories...');
        const categoriesResponse = await axios.get(`${BASE_URL}/category`);
        console.log(`✅ Categories: ${categoriesResponse.data.data.length} categories found`);
        console.log('Categories:', categoriesResponse.data.data.map(cat => cat.name));

        // Test channels
        console.log('\n3️⃣ Testing channels...');
        const channelsResponse = await axios.get(`${BASE_URL}/channel?limit=5`);
        console.log(`✅ Channels: ${channelsResponse.data.data.length} channels found (showing first 5)`);
        console.log('Channels:', channelsResponse.data.data.map(ch => ch.name));

        // Test channel search
        console.log('\n4️⃣ Testing channel search...');
        const searchResponse = await axios.get(`${BASE_URL}/channel/search?q=sports&limit=3`);
        console.log(`✅ Search results: ${searchResponse.data.data.length} channels found`);
        console.log('Search results:', searchResponse.data.data.map(ch => ch.name));

        // Test free channels
        console.log('\n5️⃣ Testing free channels...');
        const freeChannelsResponse = await axios.get(`${BASE_URL}/channel/free?limit=3`);
        console.log(`✅ Free channels: ${freeChannelsResponse.data.data.length} channels found`);
        console.log('Free channels:', freeChannelsResponse.data.data.map(ch => ch.name));

        // Test category with channels
        if (categoriesResponse.data.data.length > 0) {
            const firstCategory = categoriesResponse.data.data[0];
            console.log(`\n6️⃣ Testing category: ${firstCategory.name}...`);
            const categoryChannelsResponse = await axios.get(`${BASE_URL}/category/${firstCategory._id}?limit=3`);
            console.log(`✅ Category channels: ${categoryChannelsResponse.data.data.channels.length} channels found`);
            console.log('Category channels:', categoryChannelsResponse.data.data.channels.map(ch => ch.name));
        }

        console.log('\n🎉 All API tests completed successfully!');
        console.log('\n📊 Summary:');
        console.log(`   - Categories: ${categoriesResponse.data.data.length}`);
        console.log(`   - Total channels: ${channelsResponse.data.pagination.total_records}`);
        console.log(`   - Free channels: ${freeChannelsResponse.data.data.length}`);
        console.log(`   - Search working: ✅`);
        console.log(`   - Category filtering: ✅`);

    } catch (error) {
        console.error('❌ API test failed:', error.response?.data || error.message);
        
        if (error.code === 'ECONNREFUSED') {
            console.log('\n💡 Make sure your server is running:');
            console.log('   npm run dev');
        }
    }
};

// Run tests
if (require.main === module) {
    testAPI();
}

module.exports = { testAPI }; 