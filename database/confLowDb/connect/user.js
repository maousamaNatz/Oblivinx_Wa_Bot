const users = [];

// Function to add a new user
function addUser(userId, username) {
    const newUser = {
        user_id: userId,
        username: username,
        is_premium: false,
        is_banned: false,
        is_blocked: false,
        coins: 0.00,
        experience: 0,
        level: 1,
        ranking: null,
        total_messages: 0,
        messages_per_day: 0,
        feature_first_used: 'unknown',
        feature_last_used: 'unknown',
        total_feature_usage: 0,
        daily_feature_average: 0,
        blocked_status: 0,
        is_sewa: 0,
        language: 'id',
        anti_delete_message: 0,
        anti_hidden_tag: 0,
        anti_group_link: 0,
        anti_view_once: 0,
        auto_sticker: 0,
        log_detection: 0,
        auto_level_up: 0,
        mute_bot: 0,
        warnings: 0,
        created_at: new Date(),
        updated_at: new Date(),
        daily_xp: 0,
        last_message: new Date(),
        achievements: null,
        last_message_xp: new Date(),
        weekly_xp: 0,
        total_xp: 0
    };
    users.push(newUser);
}

// Function to get a user by user_id
function getUser(userId) {
    return users.find(user => user.user_id === userId);
}

// Function to update user information
function updateUser(userId, updates) {
    const user = getUser(userId);
    if (user) {
        Object.assign(user, updates);
        user.updated_at = new Date();
    }
}

// Function to delete a user
function deleteUser(userId) {
    const index = users.findIndex(user => user.user_id === userId);
    if (index !== -1) {
        users.splice(index, 1);
    }
}
