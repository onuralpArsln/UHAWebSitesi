const DataService = require('../server/services/data-service');
const path = require('path');

// Mock config to avoid loading full app
const config = {
    getDatabasePath: () => path.join(__dirname, '../data/news.db')
};

// Mock the config module require in data-service if needed, 
// but DataService usually takes db path or uses default.
// Let's check DataService constructor. It uses config.getDatabasePath().
// We might need to mock the config module or just ensure it works.
// Since we are running this script from scripts/, the relative paths might be tricky if not careful.
// Let's assume we can just require DataService and it will work if we set up the environment or mock config.

// Actually, let's look at DataService again. It requires config.
// const config = require('./config');
// So we rely on the actual config.

async function testUserTabs() {
    console.log('🧪 Testing allowedTabs functionality...');

    const dataService = new DataService();

    // 1. Create User with allowedTabs
    const username = `test_user_${Date.now()}`;
    const password = 'password123';
    const allowedTabs = ['dashboard', 'articles'];

    console.log(`Creating user ${username} with tabs:`, allowedTabs);

    const newUser = dataService.createUser({
        username,
        password,
        displayName: 'Test User',
        role: 'editor',
        permissions: [],
        allowedTabs
    });

    if (!newUser) {
        console.error('❌ Failed to create user');
        process.exit(1);
    }

    if (!newUser.allowedTabs || newUser.allowedTabs.length !== 2) {
        console.error('❌ allowedTabs not saved correctly:', newUser.allowedTabs);
        process.exit(1);
    }

    console.log('✅ User created with allowedTabs');

    // 2. Retrieve User
    const retrievedUser = dataService.getUserById(newUser.id);
    if (JSON.stringify(retrievedUser.allowedTabs) !== JSON.stringify(allowedTabs)) {
        console.error('❌ Retrieved allowedTabs mismatch:', retrievedUser.allowedTabs);
        process.exit(1);
    }
    console.log('✅ Retrieved user has correct allowedTabs');

    // 3. Update User
    const newTabs = ['dashboard', 'articles', 'media'];
    console.log('Updating user tabs to:', newTabs);

    const updatedUser = dataService.updateUser(newUser.id, {
        allowedTabs: newTabs
    });

    if (JSON.stringify(updatedUser.allowedTabs) !== JSON.stringify(newTabs)) {
        console.error('❌ Updated allowedTabs mismatch:', updatedUser.allowedTabs);
        process.exit(1);
    }
    console.log('✅ User updated with new allowedTabs');

    // 4. Cleanup
    console.log('Cleaning up...');
    dataService.deleteUser(newUser.id);
    console.log('✅ Test user deleted');

    console.log('🎉 All tests passed!');
}

testUserTabs().catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
});
