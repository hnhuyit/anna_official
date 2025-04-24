// utils/phoneUtils.js

// Hàm chuẩn hóa số điện thoại Việt Nam → dạng +84
export function normalizePhoneVN(phone) {
    return phone
    .replace(/[\s\-\(\)\.]/g, "")       // Xóa khoảng trắng, dấu gạch, ngoặc, chấm
    .replace(/^\+?84/, "0")             // Nếu bắt đầu bằng +84 hoặc 84 → thành 0
    .trim();
}
  
// Hàm trích xuất số điện thoại Việt Nam từ tin nhắn
export function extractPhonesFromText(text) {
    const phoneRegexVN = /(?:\+?84|0)?[\s\-\.]?\(?[1-9][0-9]{1}\)?[\s\-\.]?[0-9]{3}[\s\-\.]?[0-9]{3,4}/g;
    const matches = text.match(phoneRegexVN) || [];

    return matches
        .map(normalizePhoneVN)
        .filter(phone => /^\+84[1-9][0-9]{8,9}$/.test(phone)); // Lọc đúng định dạng VN
}
  