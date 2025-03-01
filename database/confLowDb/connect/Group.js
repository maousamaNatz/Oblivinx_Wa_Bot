const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');

// Create a lowdb adapter
const adapter = new FileSync('db.json');
const db = low(adapter);

// Set default values for the groups
db.defaults({
  groups: []
}).write();

// Function to add a new group
function addGroup(groupId, groupName, ownerId) {
  const newGroup = {
    group_id: groupId,
    group_name: groupName,
    owner_id: ownerId,
    total_members: 0,
    created_at: new Date().toISOString(),
    bot_is_admin: 0,
    registration_date: new Date().toISOString(),
    premium_status: 0,
    sewa_status: 0,
    language: 'id',
    leaderboard_rank: null,
    level: 1,
    total_xp: 0,
    current_xp: 0,
    xp_to_next_level: 1000,
    anti_bot: 0,
    anti_delete_message: 0,
    anti_hidden_tag: 0,
    anti_group_link: 0,
    anti_view_once: 0,
    auto_sticker: 0,
    log_detection: 0,
    auto_level_up: 0,
    mute_bot: 0,
    anti_country: 0,
    welcome_message: 0,
    goodbye_message: 0,
    warnings: 0
  };

  // Add the new group to the database
  db.get('groups')
    .push(newGroup)
    .write();
}

// Export the addGroup function for use in other modules
module.exports = { addGroup };
