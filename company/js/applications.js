import { db } from '../../js/firebase-config.js';
import { doc, updateDoc, collection, addDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// تحديث حالة المتقدم (Accept / Reject)
export async function updateApplicationStatus(applicationId, userId, newStatus, jobTitle) {
  try {
    const appRef = doc(db, "applications", applicationId);
    
    // 1. تحديث الحالة في قاعدة البيانات
    await updateDoc(appRef, {
      status: newStatus // هيكون إما 'accepted' أو 'rejected'
    });

    // 2. إرسال Notification للمستخدم في جدول الإشعارات الخاص به
    if (newStatus === "accepted") {
      await addDoc(collection(db, "notifications"), {
        userId: userId,
        message: `تهانينا! تم قبولك المبدئي لوظيفة (${jobTitle}) وتأهلت لمرحلة الـ Interview. سيتم التواصل معك قريباً.`,
        isRead: false,
        createdAt: new Date().toISOString()
      });
      alert("تم قبول المتقدم ونقله لجدول المقابلات، وتم إرسال الإشعار بنجاح.");
    } else {
      alert("تم رفض الطلب.");
    }

    // إعادة تحميل البيانات لتحديث الجداول تلقائياً
    reloadApplicationsTables(); 
  } catch (error) {
    console.error("Error updating status: ", error);
  }
}