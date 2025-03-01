const { Low, JSONFile } = require('lowdb');
const { users } = require('./connect/user'); // Import users from user.js
const { addGroup } = require('./connect/Group'); // Import addGroup from Group.js

// Create a new instance of LowDB with a JSON file
const file = 'db.json'; // Specify your database file
const adapter = new JSONFile(file);
const db = new Low(adapter);

// Initialize the database
async function initDB() {
    await db.read();
    db.data ||= { users: [] }; // Set default data structure if not present
    await db.write();
}

// Function to add a user
async function addUser(user) {
    users.push(user); // Use the users array from user.js
    await db.write();
}

// Function to get all users
async function getUsers() {
    await db.read();
    return users; // Return the users array from user.js
}

// Function to find a user by ID
async function findUserById(id) {
    await db.read();
    return users.find(user => user.user_id === id); // Use user_id to match
}

// Export the functions for use in other modules
module.exports = {
    initDB,
    addUser,
    getUsers,
    findUserById,
    addGroup // Export addGroup for use in other modules
};
