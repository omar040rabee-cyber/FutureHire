import { storage, db, auth } from '../js/firebase-config.js';
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";
import { collection, addDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

export async function applyForJob(jobId, companyId, cvFile) {
  try {
    const userId = auth.currentUser.uid;
    let cvUrl = "";

    if (cvFile) {
      // 1. رفع الـ CV على السيستم وتسميته بـ UID الخاص بالمستخدم لعدم التكرار
      const storageRef = ref(storage, `cvs/${userId}_${cvFile.name}`);
      const snapshot = await uploadBytes(storageRef, cvFile);
      cvUrl = await getDownloadURL(snapshot.ref);
    }

    // 2. إنشاء طلب التقديم في الكولكشن
    await addDoc(collection(db, "applications"), {
      jobId: jobId,
      companyId: companyId,
      userId: userId,
      cvUrl: cvUrl,
      status: "pending", // الحالة الافتراضية قيد الانتظار
      appliedAt: new Date().toISOString()
    });

    alert("تم التقديم على الوظيفة ورفع الـ CV بنجاح!");
  } catch (error) {
    console.error("Error applying: ", error);
    alert("حدث خطأ أثناء التقديم.");
  }
}