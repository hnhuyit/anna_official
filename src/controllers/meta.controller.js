// src/controllers/zalo.controller.js
import { handleIGMessage, handleIGPostback } from "../services/instagramService.js";
import { handleAIReply, generateAIReply } from "../services/aiResponder.js";
import { replyToComment, replyMessenger, getFacebookCommentAvatar, getFacebookUserAvatar, getFacebookUserProfile } from "../services/facebookService.js";
import { ensureUserExists, fetchConfigFromAirtable, updateLastInteractionOnlyIfNewDay } from "../config/index.js"; // Nếu bạn có gói logic refresh token vào config hoặc service riêng
import { saveMessage, getRecentMessages } from "../services/airtableService.js";
// Các hàm lưu lịch sử, cập nhật Airtable, … có thể được chuyển vào một module riêng (ví dụ airtableService)

export async function verifyWebhookIG(req, res) {
  // // Đơn giản trả về echostr nếu có logic xác thực cho GET webhook
  // const { hub: { challenge } } = req.query;
  // return res.status(200).send(challenge || "IG Webhook verified");

  // Parse the query params
  let mode = req.query["hub.mode"];
  let token = req.query["hub.verify_token"];
  let challenge = req.query["hub.challenge"];

  // Check if a token and mode is in the query string of the request
  if (mode && token) {
    // Check the mode and token sent is correct
    if (mode === "subscribe" && token === "1234567890") {
      // Respond with the challenge token from the request
      console.log("WEBHOOK_VERIFIED");
      res.status(200).send(challenge);
    } else {
      // Respond with '403 Forbidden' if verify tokens do not match
      res.status(403).send("Forbidden – Token mismatch");
    }
  }

}
export async function verifyWebhookFB(req, res) {
  // // Đơn giản trả về echostr nếu có logic xác thực cho GET webhook
  // const { hub: { challenge } } = req.query;
  // return res.status(200).send(challenge || "FB Webhook verified");

  // Parse the query params
  let mode = req.query["hub.mode"];
  let token = req.query["hub.verify_token"];
  let challenge = req.query["hub.challenge"];

  // Check if a token and mode is in the query string of the request
  if (mode && token) {
    // Check the mode and token sent is correct
    if (mode === "subscribe" && token === "1234567890") {
      // Respond with the challenge token from the request
      console.log("WEBHOOK_VERIFIED");
      res.status(200).send(challenge);
    } else {
      // Respond with '403 Forbidden' if verify tokens do not match
      res.status(403).send("Forbidden – Token mismatch");
    }
  }
}
// export async function verifyWebhookMessager(req, res) {
  
//   // Parse the query params
//   let mode = req.query["hub.mode"];
//   let token = req.query["hub.verify_token"];
//   let challenge = req.query["hub.challenge"];

//   // Check if a token and mode is in the query string of the request
//   if (mode && token) {
//     // Check the mode and token sent is correct
//     if (mode === "subscribe" && token === "1234567890") {
//       // Respond with the challenge token from the request
//       console.log("WEBHOOK_VERIFIED");
//       res.status(200).send(challenge);
//     } else {
//       // Respond with '403 Forbidden' if verify tokens do not match
//       res.status(403).send("Forbidden – Token mismatch");
//     }
//   }
// }

export async function handleFacebookWebhook(req, res, next) {
  try {
    const body = req.body;

    if (body.object !== "page") {
      return res.sendStatus(404);
    }

    const token = process.env.PAGE_ACCESS_TOKEN; // Facebook Page Token (hoặc dùng process.env.PAGE_ACCESS_TOKEN)
    const config = await fetchConfigFromAirtable();

    const SYSTEM_PROMPT = config.SYSTEM_PROMPT;
    const pageId = config.pageId;
    const platform = "facebook";

    // let avatarUrl = null;
    // try {
    //   avatarUrl = await getUserAvatarUrlFromContext(body, token);
    // } catch (err) {
    //   console.error("⚠️ Lỗi lấy avatar từ context:", err.message || err);
    //   avatarUrl = null; // fallback an toàn
    // }

    for (const entry of body.entry) {
      const webhook_event = entry.messaging?.[0];
      const changes = entry.changes || [];
      
      // ✅ Xử lý tin nhắn Messenger như trước
      if (webhook_event) {
        const sender_psid = webhook_event?.sender?.id;
        // const senderName = webhook_event?.sender?.name;
        const message = webhook_event?.message;

        // ❌ Bỏ qua nếu không có sender hoặc sender là chính page bot
        if (!sender_psid || sender_psid === pageId) {
          console.log("⏭️ Bỏ qua event từ chính page bot hoặc thiếu sender.");
          continue;
        }
        
        // Kiểm tra trạng thái bot
        if (config.bot_status !== "active") {
          console.log("🚫 Bot đang tắt, không xử lý phản hồi.");
          return res.sendStatus(200);
        }

        // ✅ Lấy avatar riêng cho message entry này
        let avatarUrl = null;
        try {
          avatarUrl = await getFacebookUserAvatar(sender_psid, token);
        } catch (err) {
          console.error("⚠️ Lỗi lấy avatar Messenger:", err.message || err);
        }

        let senderName = "(Unknown)";

        if (sender_psid) {
          try {
            senderName = await getFacebookUserProfile(sender_psid, token);
          } catch (err) {
            console.warn("⚠️ Không lấy được tên người dùng:", err.message);
          }
        }

        // ✅ Chỉ xử lý nếu là tin nhắn dạng text
        if (message?.text) {
          const userMessage = message.text;
          console.log(`📥 Messenger > User gửi: "${message}" > ${sender_psid} > ${senderName}`);

          // Đảm bảo user tồn tại trong Conversation
          const conversationId = await ensureUserExists(sender_psid, senderName, avatarUrl, "message_received", platform);
          console.log("conversationId", conversationId)

          // Lưu tin nhắn người dùng
          await saveMessage({
            userId: conversationId,
            senderName: senderName,
            role: "user",
            message: userMessage,
            platform
          });

          // ✅ Lưu lần tương tác gần nhất
          // await updateLastInteractionOnlyIfNewDay(sender_psid, senderName, "message_received", platform);

          // Lấy lịch sử
          const history = await getRecentMessages(sender_psid, platform);

          // Gọi AI và gửi phản hồi
          const aiReply = await handleAIReply(
            sender_psid,
            userMessage,
            SYSTEM_PROMPT,
            history,
            token,
            platform
          );

          // Lưu phản hồi AI
          await saveMessage({
            userId: conversationId,
            senderName: senderName,
            role: "assistant",
            message: aiReply,
            platform
          });
        } else {
          // 🛑 Bỏ qua các loại tin nhắn không phải text
          console.log("📎 Bỏ qua message không phải text:", message);
        }
      }

      // ✅ Xử lý comment từ bài viết (feed webhook)
      for (const change of changes) {
        const value = change.value;
        

        if (change.field === "feed" && value.item === "comment" && value.verb === "add") {
          const commentId = value.comment_id;
          const postId = value.post_id;
          const parentId = value.parent_id;

          const senderId = value.from?.id;
          const senderName = value.from?.name;
          const message = value.message;
          
          console.log(`📥 comment > User gửi: "${value}" > ${senderId} > ${senderName}`);
          
          // ❌ Nếu là comment trả lời (reply) → bỏ qua
          if (parentId !== postId) {
            console.log("⏭️ Bỏ qua comment reply (comment cấp 2):", commentId);
            continue;
          }

          if (!senderId) {
            console.warn("❌ Không xác định được senderId từ comment:", value);
            continue;
          }
          
          // 🚫 Nếu senderId là ID của chính page → bỏ qua
          const PAGE_ID = entry.id; // từ entry.id chính là ID page
          if (senderId === PAGE_ID) {
            console.log("⏭️ Bỏ qua comment do chính Page đăng.");
            continue;
          }

          // ✅ Lấy avatar riêng cho comment này
          // let avatarUrl = null;
          // try {
          //   avatarUrl = await getFacebookUserAvatar(senderId, token);
          // } catch (err) {
          //   console.error("⚠️ Lỗi lấy avatar comment:", err.message || err);
          // }

          console.log("💬 Comment mới:", {
            senderId,
            senderName,
            commentId,
            postId,
            message
          });
          
          // Đảm bảo user tồn tại trong Conversation
          // const conversationId = await ensureUserExists(senderId, platform, senderName);
          // const conversationId = await ensureUserExists(senderId, senderName, "", "comment_received", platform);
          
          // // console.log("conversationId", conversationId)
          // await saveMessage({
          //   userId: conversationId,
          //   senderName: senderName,
          //   role: "user",
          //   message,
          //   platform,
          //   interactionType: true
          // });

          // await updateLastInteractionOnlyIfNewDay(senderId, senderName, "comment_received", platform);

          // Lấy lịch sử
          const history = await getRecentMessages(senderId, platform);
          // console.log("history: ", history)

          // 👉 Nếu bạn muốn phản hồi comment bằng AI hoặc gửi comment lại:
          // const aiCommentReply = await handleAIReply(senderId, message, SYSTEM_PROMPT, history, token, platform);
          const aiCommentReply = await generateAIReply(message, SYSTEM_PROMPT, history, platform);

          await replyToComment(commentId, aiCommentReply, token); 

          // // Lưu phản hồi AI
          // await saveMessage({
          //   userId: conversationId,
          //   senderName: senderName,
          //   role: "assistant",
          //   message: aiCommentReply,
          //   platform,
          //   interactionType: true
          // });

        }
      }

    }
    res.status(200).send("EVENT_RECEIVED");
  } catch (err) {
    console.error("🔥 Lỗi webhook Messenger:", err);
    next(err);
  }
}

export async function handleIGWebhook(req, res) {
  const body = req.body;
  console.log("📥 [IG Webhook] Payload nhận được:", JSON.stringify(body, null, 2));

  if (body.object === 'instagram') {
    for (const entry of body.entry) {
      console.log("📌 Entry IG:", JSON.stringify(entry, null, 2));
      const changes = entry.messaging || [];

      for (const event of changes) {
        console.log("🔄 IG Event:", JSON.stringify(event, null, 2));
        const sender_psid = event.sender.id;
        console.log("👤 IG Sender PSID:", sender_psid);

        if (event.message) {
          console.log("📩 IG Message content:", event.message);
          await handleIGMessage(sender_psid, event.message);
        } else if (event.postback) {
          console.log("🔘 IG Postback content:", event.postback);
          await handleIGPostback(sender_psid, event.postback);
        } else {
          console.log("❓ Không phải message hoặc postback:", event);
        }
      }
    }

    res.status(200).send("IG_EVENT_RECEIVED");
  } else {
    console.warn("⚠️ Webhook không phải từ IG:", body.object);
    res.sendStatus(404);
  }
}


// function handlePostback(sender_psid, postback) {
//   const payload = postback.payload;
//   console.log("🧠 Postback từ người dùng:", payload);

//   let response;

//   if (payload === 'GET_STARTED') {
//     response = { text: "Chào mừng bạn đến với LUXX! 💅 Hãy nhắn 'menu' để xem dịch vụ." };
//   } else if (payload === 'VIEW_SERVICES') {
//     response = { text: "Dưới đây là các dịch vụ của LUXX Spa...\n🦶 Pedicure, ✋ Manicure, 💅 Nail Art, v.v..." };
//   } else {
//     response = { text: `Bạn vừa bấm nút có payload: "${payload}"` };
//   }

//   callSendAPI(sender_psid, response);
// }

// function handleMessage(sender_psid, received_message) {
//   console.log("Message from", sender_psid, ":", received_message.text);
//   // Ở đây bạn có thể gọi API gửi tin nhắn phản hồi
//   let response;

//   if (received_message.text) {
//     // Xử lý text bình thường
//     response = {
//       "text": `Bạn vừa nói: "${received_message.text}". LUXX cảm ơn bạn đã nhắn tin! 🌸`
//     };
//   } else {
//     // Trường hợp không phải tin nhắn text (ảnh, audio,...)
//     response = {
//       "text": "LUXX hiện tại chỉ tiếp nhận tin nhắn dạng văn bản. Hẹn gặp bạn sau nhé! 💅"
//     };
//   }

//   // Gửi phản hồi
//   callSendAPI(sender_psid, response);
// }

// async function callSendAPI(sender_psid, response) {
//   const request_body = {
//     recipient: {
//       id: sender_psid
//     },
//     messaging_type: "RESPONSE",
//     message: response
//   };

//   try {
//     const res = await axios.post(
//       `https://graph.facebook.com/v22.0/me/messages?access_token=${process.env.PAGE_ACCESS_TOKEN}`,
//       request_body
//     );
//     console.log("✅ Tin nhắn đã gửi thành công!", res.data);
//   } catch (err) {
//     console.error(`❌ Gửi tin nhắn cho ${sender_psid} thất bại:`, err.response ? err.response.data : err.message);
//   }
// }