import axios from "axios";

/**
 * Trả lời 1 comment trên Facebook
 * @param {string} commentId - ID của comment gốc
 * @param {string} message - Nội dung phản hồi
 * @param {string} accessToken - Page Access Token
 */
export async function replyToComment(commentId, message, accessToken) {
  try {
    const res = await axios.post(
      `https://graph.facebook.com/v22.0/${commentId}/comments`,
      { message },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    );

    console.log("✅ Đã phản hồi comment:", res.data);
    return res.data;
  } catch (err) {
    console.error("❌ Lỗi khi phản hồi comment:", err.response?.data || err.message);
  }
}

export async function getFacebookCommentAvatar(fbid, pageAccessToken) {
  try {
    const res = await axios.get(`https://graph.facebook.com/${fbid}/picture`, {
      params: {
        width: 500,
        height: 500,
        redirect: false,
        access_token: pageAccessToken,
      },
    });

    const data = res.data?.data;
    if (data?.is_silhouette) return null; // Nếu là avatar mặc định

    return data?.url || null;
  } catch (error) {
    console.error("❌ Lỗi lấy avatar comment:", error.response?.data || error.message);
    return null;
  }
}

export async function getFacebookUserAvatar(psid, pageAccessToken) {
  try {
    const res = await axios.get(`https://graph.facebook.com/${psid}/picture`, {
      params: {
        width: 500,
        height: 500,
        redirect: false,
        access_token: pageAccessToken,
      },
    });

    const data = res.data?.data;
    if (data?.is_silhouette) return null;

    return data?.url || null;
  } catch (error) {
    console.error("❌ Lỗi lấy avatar Messenger:", error.response?.data || error.message);
    return null;
  }
}

export async function replyMessenger(sender_psid, text, token) {
  const body = {
    recipient: { id: sender_psid },
    messaging_type: "RESPONSE",
    message: { text }
  };

  try {
    const res = await axios.post(
      `https://graph.facebook.com/v22.0/me/messages?access_token=${token}`,
      body
    );
    console.log("📩 Đã gửi tin nhắn Messenger:", res.data);
    return res.data; // ✅ Trả về kết quả gửi
  } catch (err) {
    console.error("❌ Lỗi gửi tin nhắn Messenger:", err.response?.data || err.message);
    throw err;
  }
}