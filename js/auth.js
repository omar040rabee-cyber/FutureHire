import { auth, db } from './firebase-config.js';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ==========================================
// 1. تسجيل حساب باحث عن عمل جديد (User Only)
// ==========================================
export async function registerUser(email, password, fullName) {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // حفظ البيانات في Firestore وتعيين الـ role تلقائياً كـ "user"
    await setDoc(doc(db, "users", user.uid), {
      uid: user.uid,
      fullName: fullName,
      email: email,
      role: "user", // افتراضي لأي شخص يسجل من الواجهة العامة
      phone: "",
      cvUrl: "",
      portfolioUrl: "",
      createdAt: new Date().toISOString()
    });

    alert("تم إنشاء حسابك بنجاح! أهلاً بك في FutureHire.");
    window.location.href = "user/explore.html"; // توجيهه لصفحة استكشاف الوظائف مباشرة
  } catch (error) {
    console.error("Error during registration: ", error);
    alert("حدث خطأ أثناء التسجيل: " + error.message);
  }
}

// ==========================================
// 2. تسجيل الدخول والتوجيه الذكي (لكل الأدوار)
// ==========================================
export async function loginUser(email, password) {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // جلب بيانات الحساب من Firestore لمعرفة الـ Role والتوجيه لمكانه الصحيح
    const userDoc = await getDoc(doc(db, "users", user.uid));
    
    if (userDoc.exists()) {
      const userData = userDoc.data();
      const role = userData.role;

      if (role === "admin") {
        window.location.href = "admin/dashboard.html";
      } else if (role === "company") {
        // إذا كان حساب شركة، نتأكد أولاً أن الاشتراك نشط وساري
        if (userData.subscriptionStatus === "active") {
          window.location.href = "company/dashboard.html";
        } else {
          alert("عذراً، اشتراك الشركة منتهي أو غير نشط. يرجى التواصل مع الإدارة للتجديد.");
          await signOut(auth);
        }
      } else {
        // لو مستخدم عادي (User)
        window.location.href = "user/explore.html";
      }
    } else {
      alert("لم يتم العثور على بيانات إضافية لهذا المستخدم في قاعدة البيانات.");
    }
  } catch (error) {
    console.error("Error during login: ", error);
    alert("خطأ في تسجيل الدخول: " + error.message);
  }
}

// ==========================================
// 3. التحكم في إرسال النموذج (Form Submission)
// ==========================================
document.getElementById("auth-form").addEventListener("submit", async function(e) {
    e.preventDefault();

    const email = document.getElementById("auth-email").value;
    const password = document.getElementById("auth-password").value;
    const submitBtnText = document.getElementById("submit-btn").innerText;

    if (submitBtnText === "إنشاء الحساب") {
        const fullName = document.getElementById("auth-name").value;
        if (!fullName.trim()) {
            alert("يرجى إدخال الاسم بالكامل");
            return;
        }
        await registerUser(email, password, fullName);
    } else {
        await loginUser(email, password);
    }
});