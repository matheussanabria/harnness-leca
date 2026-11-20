// @ts-check
const { apiChat, chatStreamRoutes, apiChatSave } = require("../controllers/chat.controller");
const { apiChatUpload } = require("../controllers/upload.controller");
const { conversationRoutes } = require("../controllers/chat-conversations.controller");

const chatRoutes = [
  { method: "POST", path: "/api/chat", handler: apiChat },
  ...chatStreamRoutes,
  ...conversationRoutes,
  { method: "POST", path: "/api/chat/save", handler: apiChatSave },
  { method: "POST", path: "/api/chat/upload", handler: apiChatUpload },
];

module.exports = { chatRoutes };
