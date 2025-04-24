// utils/notifyUtils.js
import axios from "axios";
import {  fetchConfigFromAirtable } from "../config/index.js"; // Nếu bạn có gói logic refresh token vào config hoặc service riêng


// Gọi từ webhook để cảnh báo khi phát hiện số điện thoại
export async function notifyPhoneDetected({ userId, phones, message, platform }) {
    const alertText = `📞 [${platform}] User ${userId} gửi số: ${phones.join(", ")}\n💬 Nội dung: "${message}"`;
    console.log(alertText);
    
    await sendZaloAlert(alertText);
}

// Gửi tin nhắn chủ động từ OA sang người dùng nội bộ (admin)
export async function sendZaloAlert(message) {
    const config = await fetchConfigFromAirtable();
    console.log("zalo: ", config.ADMIN_ZALO_USER_ID, config.ZALO_ACCESS_TOKEN)

    if (!config.ZALO_ACCESS_TOKEN || !config.ADMIN_ZALO_USER_ID) {
      console.warn("❗ Thiếu ZALO_ACCESS_TOKEN hoặc ADMIN_ZALO_USER_ID");
      return;
    }
  
    try {
      const res = await axios.post(
        "https://openapi.zalo.me/v3.0/oa/message/cs",
        {
          recipient: { user_id: config.ADMIN_ZALO_USER_ID },
          message: {
            text: message
          }
        },
        {
          headers: {
            "access_token": `Bearer ${config.ZALO_ACCESS_TOKEN}`,
            "Content-Type": "application/json"
          }
        }
      );

      if (res.data.error !== 0) {
        console.warn("⚠️ Zalo CS API phản hồi lỗi:", res.data);
      } else {
        console.log("✅ Đã gửi tin nhắn cảnh báo Zalo:", res.data);
      }
    //   console.log("✅ Đã gửi tin nhắn cảnh báo Zalo:", res.data);
    } catch (err) {
      console.error("❌ Lỗi khi gửi tin nhắn OA Zalo:", err.response?.data || err.message);
    }
}