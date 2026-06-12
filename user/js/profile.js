import { db, auth } from '../../js/firebase-config.js';  // تأكدي من مسار ملف الكونفيج عندك
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// تعريف عناصر واجهة المستخدم (تأكدي من مطابقة الـ IDs في ملف الـ HTML)
const profileForm = document.getElementById('profileForm');
const userNameInput = document.getElementById('userName');
const userEmailInput = document.getElementById('userEmail');
const myApplicationsTable = document.getElementById('myApplicationsTable'); // البادي بتاع الـ Table أو الـ Container

// التأكد من تسجيل دخول المستخدم أولاً
onAuthStateChanged(auth, async (user) => {
    if (user) {
        console.log("👤 المستخدم الحالي مسجل دخول بـ ID:", user.uid);
        // 1. تحميل بيانات الحساب الشخصي
        await loadUserProfile(user.uid);
        // 2. تحميل طلبات التوظيف الخاصة بالمستخدم
        await loadUserApplications(user.uid);
    } else {
        // إذا لم يكن مسجل دخول، يتم توجيهه لصفحة تسجيل الدخول
        window.location.href = "../login.html";
    }
});

// ==========================================
// أولاً: جلب وعرض بيانات الحساب الشخصي
// ==========================================
async function loadUserProfile(userId) {
    try {
        const userDoc = await getDoc(doc(db, "users", userId));
        if (userDoc.exists()) {
            const userData = userDoc.data();
            // ملء الحقول في الـ HTML بالبيانات القادمة من قاعدة البيانات
            if(userNameInput) userNameInput.value = userData.fullName || "";
            if(userEmailInput) userEmailInput.value = userData.email || "";
        }
    } catch (error) {
        console.error("خطأ في تحميل بيانات الملف الشخصي:", error);
    }
}

// ==========================================
// ثانياً: جلب وعرض طلبات التوظيف (طلباتي)
// ==========================================
async function loadUserApplications(userId) {
    if (!myApplicationsTable) return;

    try {
        myApplicationsTable.innerHTML = `<tr><td colspan="5" class="text-center py-3">جاري تحميل طلباتك...</td></tr>`;

        // عمل استعلام لجلب الطلبات اللى فيها الـ userId يساوى المستخدم الحالي
        const q = query(collection(db, "applications"), where("userId", "==", userId));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            myApplicationsTable.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-4">لم تقم بالتقديم على أي وظيفة حتى الآن.</td></tr>`;
            return;
        }

        let tableHTML = "";
        let index = 1;

        querySnapshot.forEach((docSnap) => {
            const appData = docSnap.data();
            
            // تخصيص لون شارة (Badge) الحالة بناءً على حالة الطلب
            let statusBadge = "";
            if (appData.status === "pending") {
                statusBadge = `<span class="badge bg-warning text-dark px-2.5 py-1.5 rounded-3">قيد الانتظار</span>`;
            } else if (appData.status === "accepted") {
                statusBadge = `<span class="badge bg-success px-2.5 py-1.5 rounded-3">مقبول 🎉</span>`;
            } else if (appData.status === "rejected") {
                statusBadge = `<span class="badge bg-danger px-2.5 py-1.5 rounded-3">مرفوض</span>`;
            }

            // تنسيق التاريخ ليظهر بشكل مقروء ونظيف
            const applyDate = appData.appliedAt ? new Date(appData.appliedAt).toLocaleDateString('ar-EG') : "غير محدد";

            tableHTML += `
                <tr>
                    <th scope="row" class="align-middle">${index++}</th>
                    <td class="align-middle fw-bold text-primary">${appData.jobTitle || "وظيفة غير محددة"}</td>
                    <td class="align-middle text-secondary">${appData.companyName || "شركة مسجلة"}</td>
                    <td class="align-middle">${applyDate}</td>
                    <td class="align-middle">${statusBadge}</td>
                </tr>
            `;
        });

        myApplicationsTable.innerHTML = tableHTML;

    } catch (error) {
        console.error("خطأ أثناء جلب طلبات التوظيف:", error);
        myApplicationsTable.innerHTML = `<tr><td colspan="5" class="text-center text-danger py-3">حدث خطأ أثناء تحميل البيانات.</td></tr>`;
    }
}

// ==========================================
// ثالثاً: تحديث بيانات الملف الشخصي عند الضغط على حفظ
// ==========================================
if (profileForm) {
    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = auth.currentUser;
        if (!user) return;

        try {
            await updateDoc(doc(db, "users", user.uid), {
                fullName: userNameInput.value.trim()
            });
            alert("تم تحديث ملفك الشخصي بنجاح! ✨");
        } catch (error) {
            console.error("خطأ في تحديث البيانات:", error);
            alert("حدث خطأ أثناء التحديث، حاول مجدداً.");
        }
    });
}


// 8. تشغيل زر تسجيل الخروج
// ==========================================
logoutBtn.addEventListener("click", () => {
    signOut(auth).then(() => {
        alert("تم تسجيل خروجك بنجاح.");
        window.location.href = "../auth.html";
    }).catch((error) => {
        console.error("خطأ أثناء تسجيل الخروج:", error);
    });
});