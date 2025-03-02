const path = require("path");
const fs = require("fs");
const { createCanvas, loadImage, registerFont } = require("canvas");
const axios = require("axios");

// Register custom fonts
registerFont(
  path.join(__dirname, "../../media/welandouts/RussoOne-Regular.ttf"),
  {
    family: "Russo One",
  }
);
registerFont(
  path.join(__dirname, "../../media/welandouts/PTMono-Regular.ttf"),
  {
    family: "PT Mono",
  }
);

const sendMessage = async (client, chatId, text) => {
  if (!client) {
    console.error("Client is undefined");
    return;
  }
  await client.sendMessage(chatId, { text });
};

const sendImage = async (client, chatId, imagePath, caption) => {
  try {
    const image = await fs.promises.readFile(imagePath);
    await client.sendMessage(chatId, { image, caption }, { quoted: null });
  } catch (error) {
    console.error("Error reading image file:", error.message);
    await client.sendMessage(chatId, "Gagal membaca file gambar.");
  }
};

// Function to download an image from a URL
const downloadImage = async (url, filepath) => {
  const writer = fs.createWriteStream(filepath);
  const response = await axios({
    url,
    method: "GET",
    responseType: "stream",
  });

  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on("finish", resolve);
    writer.on("error", reject);
  });
};

const downloadProfileImage = async (client, id) => {
  try {
    const url = await client.profilePictureUrl(id, "image");
    const response = await axios.get(url, { responseType: "arraybuffer" });
    return Buffer.from(response.data, "binary");
  } catch (error) {
    console.error(`Error downloading profile image: ${error.message}`);
    return null;
  }
};

const createWelcomeImage = async (
  groupName,
  userName,
  groupImageBuffer,
  userImageBuffer
) => {
  try {
    const width = 1920;
    const height = 480;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    // Load and draw background image
    const background = await loadImage(
      path.join(__dirname, "../../media/welandouts/ppsn-100.jpg")
    );
    ctx.drawImage(background, 0, 0, width, height);

    // Draw circles for group and user avatars
    ctx.fillStyle = "#3B4A5D";
    ctx.beginPath();
    ctx.arc(160, 240, 120, 0, Math.PI * 2, true); // Left circle for user avatar
    ctx.fill();

    ctx.beginPath();
    ctx.arc(1760, 240, 120, 0, Math.PI * 2, true); // Right circle for group avatar
    ctx.fill();

    // Load and draw user avatar
    const avatar = await loadImage(
      userImageBuffer ||
        path.join(__dirname, "../../media/welandouts/defaultWa.jpeg")
    );
    ctx.save();
    ctx.beginPath();
    ctx.arc(160, 240, 100, 0, Math.PI * 2, true); // Clip user image inside circle
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(avatar, 60, 140, 200, 200);
    ctx.restore();

    // Load and draw group avatar
    const groupAvatar = await loadImage(
      groupImageBuffer ||
        path.join(__dirname, "../../media/welandouts/defaultWa.jpeg")
    );
    ctx.save();
    ctx.beginPath();
    ctx.arc(1760, 240, 100, 0, Math.PI * 2, true); // Clip group image inside circle
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(groupAvatar, 1660, 140, 200, 200);
    ctx.restore();

    // Draw the group name and welcome message (above the "Welcome" text)
    ctx.font = '18px "PT Mono"';
    ctx.fillStyle = "#3B3F51";

    const mainMessage = `${groupName}`;
    const mainMessageWidth = ctx.measureText(mainMessage).width;
    ctx.fillText(mainMessage, (width - mainMessageWidth) / 2, 160); // Adjusted position (above "Welcome")

    // Draw "Welcome" text
    ctx.font = 'bold 180px "Russo One"';
    ctx.fillStyle = "#495774";

    // Center the "Welcome" text
    const welcomeText = "Welcome";
    const welcomeTextWidth = ctx.measureText(welcomeText).width;
    ctx.fillText(welcomeText, (width - welcomeTextWidth) / 2, 300); // Centered horizontally, adjusted vertically

    // Function to wrap text into lines with max width
    const wrapText = (context, text, maxWidth) => {
      const words = text.split(" ");
      let lines = [];
      let currentLine = words[0];

      for (let i = 1; i < words.length; i++) {
        const word = words[i];
        const width = context.measureText(currentLine + " " + word).width;
        if (width < maxWidth) {
          currentLine += " " + word;
        } else {
          lines.push(currentLine);
          currentLine = word;
        }
      }
      lines.push(currentLine);
      return lines;
    };

    // Draw additional welcome message (smaller text at the bottom)
    ctx.font = '18px "PT Mono"';
    const smallMessage = `Selamat datang ${userName} di grup ${groupName}! Semoga betah dan menikmati waktu di sini. Jangan ragu untuk bertanya atau berinteraksi. Selamat bergabung! :D`;

    // Define max width for text wrapping and center position
    const maxTextWidth = 1200; // Set the max width for the long text area
    const wrappedText = wrapText(ctx, smallMessage, maxTextWidth);

    // Calculate line height based on font size
    const lineHeight = 23; // Same as the font size (23px) for line height 1

    // Draw each line of wrapped text with no extra spacing (line height 1) and centered alignment
    wrappedText.forEach((line, index) => {
      const lineWidth = ctx.measureText(line).width;
      const xPos = (width - lineWidth) / 2; // Calculate the X position to center the line
      ctx.fillText(line, xPos, 340 + index * lineHeight); // No extra spacing between lines
    });

    // Save the image
    const buffer = canvas.toBuffer("image/png");
    const imagePath = path.join(
      __dirname,
      `../../media/downloads/welcome_${Date.now()}.png`
    );
    fs.writeFileSync(imagePath, buffer);

    return imagePath;
  } catch (error) {
    console.error("Error in createWelcomeImage function:", error);
    throw error;
  }
};

const createGoodbyeImage = async (
  groupName,
  userName,
  groupImageBuffer,
  userImageBuffer
) => {
  try {
    const width = 1920;
    const height = 480;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    // Load and draw background image
    const background = await loadImage(
      path.join(__dirname, "../../media/welandouts/ppsn-100.jpg")
    );
    ctx.drawImage(background, 0, 0, width, height);

    // Draw circles for group and user avatars
    ctx.fillStyle = "#3B4A5D";
    ctx.beginPath();
    ctx.arc(160, 240, 120, 0, Math.PI * 2, true); // Left circle for user avatar
    ctx.fill();

    ctx.beginPath();
    ctx.arc(1760, 240, 120, 0, Math.PI * 2, true); // Right circle for group avatar
    ctx.fill();

    // Load and draw user avatar
    const avatar = await loadImage(
      userImageBuffer ||
        path.join(__dirname, "../../media/welandouts/defaultWa.jpeg")
    );
    ctx.save();
    ctx.beginPath();
    ctx.arc(160, 240, 100, 0, Math.PI * 2, true); // Clip user image inside circle
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(avatar, 60, 140, 200, 200);
    ctx.restore();

    // Load and draw group avatar
    const groupAvatar = await loadImage(
      groupImageBuffer ||
        path.join(__dirname, "../../media/welandouts/defaultWa.jpeg")
    );
    ctx.save();
    ctx.beginPath();
    ctx.arc(1760, 240, 100, 0, Math.PI * 2, true); // Clip group image inside circle
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(groupAvatar, 1660, 140, 200, 200);
    ctx.restore();

    // Draw the group name and goodbye message (above the "Goodbye" text)
    ctx.font = '18px "PT Mono"';
    ctx.fillStyle = "#3B3F51";

    const mainMessage = `${groupName}`;
    const mainMessageWidth = ctx.measureText(mainMessage).width;
    ctx.fillText(mainMessage, (width - mainMessageWidth) / 2, 160); // Adjusted position (above "Goodbye")

    // Draw "Goodbye" text
    ctx.font = 'bold 180px "Russo One"';
    ctx.fillStyle = "#495774";

    // Center the "Goodbye" text
    const goodbyeText = "Goodbye";
    const goodbyeTextWidth = ctx.measureText(goodbyeText).width;
    ctx.fillText(goodbyeText, (width - goodbyeTextWidth) / 2, 300); // Centered horizontally, adjusted vertically

    // Function to wrap text into lines with max width
    const wrapText = (context, text, maxWidth) => {
      const words = text.split(" ");
      let lines = [];
      let currentLine = words[0];

      for (let i = 1; i < words.length; i++) {
        const word = words[i];
        const width = context.measureText(currentLine + " " + word).width;
        if (width < maxWidth) {
          currentLine += " " + word;
        } else {
          lines.push(currentLine);
          currentLine = word;
        }
      }
      lines.push(currentLine);
      return lines;
    };

    // Draw additional goodbye message (smaller text at the bottom)
    ctx.font = '18px "PT Mono"';
    const smallMessage = `Selamat tinggal ${userName} di grup ${groupName}! Trimakasih sudah bergabung dengan kami dan semoga Anda menikmati waktu Anda di sini.`;

    // Define max width for text wrapping and center position
    const maxTextWidth = 1200; // Set the max width for the long text area
    const wrappedText = wrapText(ctx, smallMessage, maxTextWidth);

    // Calculate line height based on font size
    const lineHeight = 23; // Same as the font size (23px) for line height 1

    // Draw each line of wrapped text with no extra spacing (line height 1) and centered alignment
    wrappedText.forEach((line, index) => {
      const lineWidth = ctx.measureText(line).width;
      const xPos = (width - lineWidth) / 2; // Calculate the X position to center the line
      ctx.fillText(line, xPos, 340 + index * lineHeight); // No extra spacing between lines
    });

    // Save the image
    const buffer = canvas.toBuffer("image/png");
    const imagePath = path.join(
      __dirname,
      `../../media/downloads/goodbye_${Date.now()}.png`
    );
    fs.writeFileSync(imagePath, buffer);

    return imagePath;
  } catch (error) {
    console.error("Error in createGoodbyeImage function:", error);
    throw error;
  }
};

const handleGroupUpdate = async (client, update) => {
  const { participants, action, id } = update;
  const groupName = await client
    .groupMetadata(id)
    .then((metadata) => metadata.subject)
    .catch(() => "Group");
  const idgroup = id;

  for (const participant of participants) {
    const userName = participant.split("@")[0];

    try {
      console.log(`Processing ${action} for ${userName} in group ${groupName}`);
      console.log(`Processing ${action} for ${userName} in group ${idgroup}`);

      const groupImageBuffer = await downloadProfileImage(client, id);
      const userImageBuffer = await downloadProfileImage(client, participant);

      let imagePath, caption;
      if (action === "add") {
        imagePath = await createWelcomeImage(
          groupName,
          userName,
          groupImageBuffer,
          userImageBuffer
        );
        caption = `Selamat datang, ${userName}! semoga jadi member ${groupName}`;
      } else if (action === "remove") {
        imagePath = await createGoodbyeImage(
          groupName,
          userName,
          groupImageBuffer,
          userImageBuffer
        );
        caption = `Selamat tinggal, ${userName}! Trimakasih sudah bergabung dengan kami dan semoga Anda menikmati waktu Anda di sini.`;
      }

      if (imagePath) {
        await client.sendMessage(id, {
          image: { url: imagePath },
          caption: caption,
        });
        console.log(`pesan terkirim`);
        fs.unlinkSync(imagePath);
        console.log(`File ${imagePath} deleted.`);
      }
    } catch (error) {
      console.error(`Error processing ${action} for ${userName}:`, error);
    }
  }
};

// New function to automatically welcome users when added to the database
const welcomeNewUser = async (client, userId, groupId) => {
  const groupName = await client
    .groupMetadata(groupId)
    .then((metadata) => metadata.subject)
    .catch(() => "Group");

  const userImageBuffer = await downloadProfileImage(client, userId);
  const groupImageBuffer = await downloadProfileImage(client, groupId);

  const imagePath = await createWelcomeImage(groupName, userId.split("@")[0], groupImageBuffer, userImageBuffer);
  const caption = `Selamat datang, ${userId.split("@")[0]}! Semoga betah di grup ${groupName}`;

  await client.sendMessage(groupId, {
    image: { url: imagePath },
    caption: caption,
  });
  console.log(`Welcome message sent to ${userId}`);
};

module.exports = { handleGroupUpdate, welcomeNewUser };