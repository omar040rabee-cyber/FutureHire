import { auth, db } from './firebase-config.js';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ==========================================
// 1. تسجيل حساب جديد (سواء باحث عن عمل أو شركة)
// ==========================================
export async function registerAccount(email, password, fullName, role) {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // بيانات مبدئية مشتركة
    const userData = {
      uid: user.uid,
      fullName: fullName,
      email: email,
      role: role,
      createdAt: new Date().toISOString()
    };

    // تخصيص البيانات حسب نوع الحساب
    if (role === "company") {
      userData.subscriptionStatus = "active";
      userData.subscriptionPrice = 1000; // السعر الافتراضي
      
      // اشتراك لمدة سنة افتراضية للشركات المسجلة ذاتياً
      const expiry = new Date();
      expiry.setFullYear(expiry.getFullYear() + 1);
      userData.expiryDate = expiry.toISOString();
    } else {
      userData.phone = "";
      userData.cvUrl = "";
      userData.portfolioUrl = "";
    }

    // حفظ البيانات في Firestore
    await setDoc(doc(db, "users", user.uid), userData);

    alert("تم إنشاء الحساب بنجاح!");
    
    // التوجيه الذكي بعد التسجيل
    if (role === "company") {
        window.location.href = "company/dashboard.html";
    } else {
        window.location.href = "user/explore.html"; 
    }
  } catch (error) {
    console.error("Error during registration: ", error);
    alert("حدث خطأ أثناء التسجيل: " + error.message);
  }
}

// ==========================================
// 2. تسجيل الدخول والتوجيه الذكي
// ==========================================
export async function loginUser(email, password) {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    const userDoc = await getDoc(doc(db, "users", user.uid));
    
    if (userDoc.exists()) {
      const userData = userDoc.data();
      const role = userData.role;

      if (role === "admin") {
        window.location.href = "admin/dashboard.html";
      } else if (role === "company") {
        if (userData.subscriptionStatus === "active") {
          window.location.href = "company/dashboard.html";
        } else {
          alert("عذراً، اشتراك الشركة منتهي. يرجى التواصل مع الإدارة للتجديد.");
          await signOut(auth);
        }
      } else {
        window.location.href = "user/explore.html";
      }
    } else {
      alert("لم يتم العثور على بيانات لهذا المستخدم.");
    }
  } catch (error) {
    console.error("Error during login: ", error);
    alert("خطأ في تسجيل الدخول: " + error.message);
  }
}

// ==========================================
// 3. التقاط حدث إرسال النموذج (Form Submit)
// ==========================================
document.getElementById("auth-form").addEventListener("submit", async function(e) {
    e.preventDefault();

    const email = document.getElementById("auth-email").value;
    const password = document.getElementById("auth-password").value;
    
    // التحقق من النص الموجود في الزر لمعرفة المود
    const submitBtnText = document.getElementById("submit-btn").innerText;

    if (submitBtnText === "إنشاء الحساب") {
        const fullName = document.getElementById("auth-name").value;
        const role = document.getElementById("auth-role").value;
        await registerAccount(email, password, fullName, role);
    } else {
        await loginUser(email, password);
    }
});