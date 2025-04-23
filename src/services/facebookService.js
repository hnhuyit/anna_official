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
    const response = await axios.get(`https://graph.facebook.com/v19.0/${psid}/picture`, {
      params: {
        width: 500,
        height: 500,
        redirect: false, // Lấy JSON thay vì redirect ảnh
        access_token: pageAccessToken,
      },
    });

    const data = response.data?.data;

    // ❌ Avatar mặc định (silhouette) → bỏ qua
    if (data?.is_silhouette) {
      console.warn(`⚠️ PSID ${psid} có ảnh mặc định (silhouette).`);
      return null;
    }

    return data?.url || null;
  } catch (err) {
    const fbError = err?.response?.data?.error;

    if (fbError?.code === 100 && fbError?.error_subcode === 33) {
      console.warn(`⚠️ Không thể truy cập avatar người dùng ${psid} (không đủ quyền hoặc chưa nhắn tin).`);
    } else {
      console.error("❌ Lỗi lấy avatar Messenger:", fbError || err.message);
    }

    return null; // fallback nếu lỗi
  }
}

export async function getFacebookUserProfile(psid, pageAccessToken) {
  try {
    const response = await axios.get(`https://graph.facebook.com/v19.0/${psid}`, {
      params: {
        fields: "name,first_name,last_name",
        access_token: pageAccessToken,
      },
    });

    const { name, first_name, last_name } = response.data;

    // Ưu tiên dùng full name nếu có
    if (name) return name.trim();
    if (first_name || last_name) return `${first_name || ""} ${last_name || ""}`.trim();

    return "(Unknown)";
  } catch (err) {
    const fbError = err?.response?.data?.error;
    console.warn("⚠️ Không thể lấy tên người dùng:", fbError || err.message);
    return "(Unknown)";
  }
}

// export async function getUserAvatarUrlFromContext(context, pageAccessToken) {
//   try {
//     if (context.object !== 'page') return null;

//     for (const entry of context.entry) {
//       const messaging = entry.messaging?.[0];
//       if (messaging?.sender?.id) {
//         return await getFacebookUserAvatar(messaging.sender.id, pageAccessToken);
//       }

//       const change = entry.changes?.[0];
//       if (change?.value?.from?.id) {
//         return await getFacebookUserAvatar(change.value.from.id, pageAccessToken);
//       }
//     }
//   } catch (err) {
//     console.error("🚫 Lỗi phân loại context avatar:", err.message);
//   }

//   return null;
// }

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