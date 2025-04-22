// src/services/airtableService.js

// import Airtable from "airtable";
// import {base, config} from "../config/index.js";
import { base } from "../config/index.js";


// Thiết lập kết nối đến Airtable với API key và base ID lấy từ config
// const base = new Airtable({ apiKey: config.airtableApiKey }).base(config.baseId);

// Tên bảng chứa lịch sử chat trong Airtable
const CHAT_HISTORY_TABLE = "ChatHistory";

/**
 * Lưu một tin nhắn (message) của người dùng hoặc trợ lý vào bảng ChatHistory.
 * @param {Object} params - Các tham số cho tin nhắn.
 * @param {string} params.userId - ID của người dùng.
 * @param {string} params.role - Vai trò người gửi ("user" hoặc "assistant").
 * @param {string} params.message - Nội dung tin nhắn.
 * @returns {Promise<Object>} - Thông tin record vừa tạo.
 */
export async function saveMessage({ userId, senderName = "", role, message, platform = "unknown", interactionType = false}) {
  try {
    const record = await base(CHAT_HISTORY_TABLE).create([{
      fields: {
        UserID: [userId],
        Role: role,
        Message: message,
        interactionType: interactionType,
        Platform: platform,
        Timestamp: new Date().toISOString() // Dùng định dạng ISO để Airtable hiểu
      }
    }]);
    // console.log("✅ Saved message record:", record);
    return record;
  } catch (error) {
    console.error("🔥 Error saving message:", error);
    throw error;
  }
}

/**
 * Lấy danh sách tin nhắn gần đây của người dùng từ bảng ChatHistory.
 * Các tin nhắn được sắp xếp theo thứ tự thời gian tăng dần (chronological order).
 * @param {string} userId - ID của người dùng.
 * @param {number} [limit=100] - Số lượng tối đa tin nhắn lấy về.
 * @returns {Promise<Array>} - Mảng các tin nhắn với dạng { role, content, timestamp }.
 */
export async function getRecentMessages(userId, platform = null, limit = 100) {
  try {
    const formula = platform
      // ? `AND({UserID} = "${userId}", {Platform} = "${platform}")`
      // : `{UserID} = "${userId}"`;
      
      ? `AND(UserID = '${userId}', Platform = '${platform}')`
      : `UserID = '${userId}'`;

    const records = await base(CHAT_HISTORY_TABLE)
      .select({
        // Lọc theo userId (bạn cần đảm bảo tên trường trong Airtable là "UserID")
        filterByFormula: formula,
        sort: [{ field: "Timestamp", direction: "desc" }],
        maxRecords: limit
      })
      .firstPage();

    // Mặc định Airtable trả về danh sách theo thứ tự giảm dần, nên đảo mảng để có thứ tự tăng dần
    const messages = records
      .map(record => ({
        role: record.get("Role"),
        content: record.get("Message"),
        timestamp: record.get("Timestamp")
      }))
      .reverse();

    // console.log("✅ Retrieved messages:", messages);
    return messages;
  } catch (error) {
    console.error("🔥 Error retrieving messages:", error);
    throw error;
  }
}
