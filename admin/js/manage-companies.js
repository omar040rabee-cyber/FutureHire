import { db, firebaseConfig } from '../../js/firebase-config.js'; 
import { initializeApp, deleteApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword,onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    collection, setDoc, doc, updateDoc, deleteDoc, query, where, limit, startAfter, startAt, onSnapshot, getDoc 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const auth = getAuth();
// ==========================================
// دالة إضافة حساب شركة جديد بواسطة الأدمن
// ==========================================
export async function addCompanyAccount(companyName, email, password, monthlyPrice, subscriptionDurationMonths) {
    try {
        const startDate = new Date();
        const expiryDate = new Date();
        const months = parseInt(subscriptionDurationMonths);
        
        expiryDate.setMonth(startDate.getMonth() + months);
        const totalSubscriptionPrice = parseFloat(monthlyPrice) * months;

        const secondaryApp = initializeApp(firebaseConfig, "SecondaryAppInstance");
        const secondaryAuth = getAuth(secondaryApp);

        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
        const companyUser = userCredential.user;

        await setDoc(doc(db, "users", companyUser.uid), {
            uid: companyUser.uid,
            fullName: companyName,
            email: email,
            role: "company",
            subscriptionStatus: "active",
            monthlyPrice: parseFloat(monthlyPrice), 
            durationMonths: months, 
            subscriptionPrice: totalSubscriptionPrice, 
            createdAt: startDate.toISOString(),
            expiryDate: expiryDate.toISOString()
        });

        await deleteApp(secondaryApp);
        alert("تم إضافة حساب الشركة وتفعيل الاشتراك بنجاح!");
    } catch (error) {
        console.error("Error adding company: ", error);
        alert("حدث خطأ أثناء إضافة الشركة: " + error.message);
    }
}

// ==========================================
// دالة حذف شركة
// ==========================================
export async function deleteCompany(companyId) {
    if (confirm("هل أنت متأكد من حذف هذه الشركة؟ سيتم حذف جميع بياناتها.")) {
        try {
            await deleteDoc(doc(db, "users", companyId));
            alert("تم حذف الشركة بنجاح.");
        } catch (error) {
            console.error("Error deleting company: ", error);
        }
    }
}

// ==========================================
// دالة تجديد الاشتراك للشركات
// ==========================================
export async function renewSubscription(companyId, additionalMonths) {
    try {
        const companyRef = doc(db, "users", companyId);
        const companySnap = await getDoc(companyRef);

        if (companySnap.exists()) {
            const companyData = companySnap.data();
            const monthsToAdd = parseInt(additionalMonths);
            
            const monthlyPrice = companyData.monthlyPrice || (companyData.subscriptionPrice / 12 || 0);
            const currentExpiry = new Date(companyData.expiryDate);
            const today = new Date();
            
            let baseDate = currentExpiry > today ? currentExpiry : today;
            const newExpiryDate = new Date(baseDate);
            newExpiryDate.setMonth(newExpiryDate.getMonth() + monthsToAdd);

            const additionalPrice = monthlyPrice * monthsToAdd;
            const newTotalPrice = (companyData.subscriptionPrice || 0) + additionalPrice;
            const newTotalMonths = (companyData.durationMonths || 12) + monthsToAdd;

            await updateDoc(companyRef, {
                subscriptionStatus: "active",
                expiryDate: newExpiryDate.toISOString(),
                subscriptionPrice: newTotalPrice,
                durationMonths: newTotalMonths
            });

            alert("تم تجديد الاشتراك بنجاح!");
        }
    } catch (error) {
        console.error("Error renewing subscription: ", error);
    }
}

// ==========================================
// نظام الـ Pagination الذكي والـ Realtime المتطور
// ==========================================
const PAGE_SIZE = 5;
let pageStack = [];          // مصفوفة لتخزين المستند الأول من كل صفحة للرجوع إليها
let currentPageIndex = 0;    // مؤشر الصفحة الحالية
let lastVisibleCompany = null;
let unsubscribe = null; 

export async function loadCompanies(direction = 'init') {
    let q;
    
    // بناء الاستعلام بناءً على اتجاه التنقل
    if (direction === 'next') {
        currentPageIndex++;
        // نطلب PAGE_SIZE + 1 (يعني 6 عناصر) للتأكد من وجود داتا تالية
        q = query(collection(db, "users"), where("role", "==", "company"), startAfter(lastVisibleCompany), limit(PAGE_SIZE + 1));
    } else if (direction === 'prev') {
        currentPageIndex--;
        const firstDocOfPage = pageStack[currentPageIndex];
        q = query(collection(db, "users"), where("role", "==", "company"), startAt(firstDocOfPage), limit(PAGE_SIZE + 1));
    } else {
        // البداية الافتراضية 'init' أو تصفير الصفحات
        currentPageIndex = 0;
        pageStack = [];
        q = query(collection(db, "users"), where("role", "==", "company"), limit(PAGE_SIZE + 1));
    }

    if (unsubscribe) {
        unsubscribe();
    }

    unsubscribe = onSnapshot(q, (snapshot) => {
        const tbody = document.getElementById("companiesTableBody");
        const nextBtn = document.getElementById("nextBtn");
        const prevBtn = document.getElementById("prevBtn");
        
        if (snapshot.empty) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center">لا توجد شركات لعرضها.</td></tr>`;
            if (nextBtn) nextBtn.disabled = true;
            if (prevBtn) prevBtn.disabled = true;
            return;
        }

        // حفظ أول مستند في هذه الصفحة الحالية بداخل المصفوفة لكي نتمكن من العودة إليه لاحقاً
        pageStack[currentPageIndex] = snapshot.docs[0];

        tbody.innerHTML = "";
        const today = new Date();

        // نأخذ فقط الـ 5 عناصر المراد عرضها فعلياً ونترك العنصر السادس للفحص
        const docsToDisplay = snapshot.docs.slice(0, PAGE_SIZE);
        lastVisibleCompany = docsToDisplay[docsToDisplay.length - 1];

        docsToDisplay.forEach((doc) => {
            const company = doc.data();
            const expiryDate = new Date(company.expiryDate);

            const timeDiff = expiryDate - today;
            const daysLeft = Math.ceil(timeDiff / (1000 * 3600 * 24));

            let statusBadge = '';
            let renewButton = '';

            if (daysLeft < 0) {
                statusBadge = `<span class="badge bg-danger">منتهي</span>`;
                renewButton = `<button class="btn btn-sm btn-primary" onclick="renewSubscription('${doc.id}', 12)">تجديد سنة</button>`;
            } else if (daysLeft <= 7) {
                statusBadge = `<span class="badge bg-warning text-dark">ينتهي خلال ${daysLeft} يوم</span>`;
                renewButton = `<button class="btn btn-sm btn-warning" onclick="renewSubscription('${doc.id}', 12)">تجديد سنة</button>`;
            } else {
                statusBadge = `<span class="badge bg-success">ساري</span>`;
                renewButton = ``;
            }

            const formattedExpiry = expiryDate.toLocaleDateString('ar-EG');
            const currentMonthlyPrice = company.monthlyPrice || (company.subscriptionPrice / 12 || 0);

            tbody.innerHTML += `
                <tr>
                    <td>${company.fullName}</td>
                    <td>${company.email}</td>
                    <td>${company.subscriptionPrice} ج.م</td>
                    <td>${formattedExpiry}</td>
                    <td>${statusBadge}</td>
                    <td>
                        ${renewButton}
                        <button class="btn btn-sm btn-info ms-1" onclick="openEditModal('${doc.id}', '${company.fullName}', '${company.email}', '${currentMonthlyPrice}')">تعديل</button>
                        <button class="btn btn-sm btn-danger ms-1" onclick="deleteCompany('${doc.id}')">حذف</button>
                    </td>
                </tr>
            `;
        });

        // ====================================================
        // التحكم الذكي في تفعيل وتعطيل الأزرار بـ Bootstrap
        // ====================================================
        if (nextBtn) {
            // لو الفايربيز رجع عناصر أكتر من حجم الصفحة (يعني رجع 6 عناصر)، يبقى فيه صفحة تالية، شغل الزرار
            nextBtn.disabled = snapshot.docs.length <= PAGE_SIZE;
        }
        if (prevBtn) {
            // لو إحنا في الصفحة الأولى (index 0) عطل زرار السابق، غير كدة شغله يرجع عادي
            prevBtn.disabled = currentPageIndex === 0;
        }

    }, (error) => {
        console.error("Error in snapshot listener: ", error);
    });
}

// 1. فتح نافذة التعديل وملء البيانات القديمة
window.openEditModal = function (id, name, email, monthlyPrice) {
    document.getElementById("editCompanyId").value = id;
    document.getElementById("editCompanyName").value = name;
    document.getElementById("editCompanyEmail").value = email;
    document.getElementById("editSubPrice").value = parseFloat(monthlyPrice); 

    const editModal = new bootstrap.Modal(document.getElementById('editCompanyModal'));
    editModal.show();
}

// 2. حفظ التعديلات وحساب التكلفة الكلية ديناميكياً
document.getElementById("editCompanyForm").addEventListener("submit", async function (e) {
    e.preventDefault();

    const companyId = document.getElementById("editCompanyId").value;
    const newName = document.getElementById("editCompanyName").value;
    const newEmail = document.getElementById("editCompanyEmail").value;
    const newMonthlyPrice = parseFloat(document.getElementById("editSubPrice").value);

    try {
        const companyRef = doc(db, "users", companyId);
        const companySnap = await getDoc(companyRef);

        if (companySnap.exists()) {
            const companyData = companySnap.data();

            let months = companyData.durationMonths;
            if (!months) {
                const start = new Date(companyData.createdAt);
                const expiry = new Date(companyData.expiryDate);
                months = (expiry.getFullYear() - start.getFullYear()) * 12 + (expiry.getMonth() - start.getMonth());
                if (months <= 0) months = 1; 
            }

            const updatedTotalPrice = newMonthlyPrice * months;

            await updateDoc(companyRef, {
                fullName: newName,
                email: newEmail,
                monthlyPrice: newMonthlyPrice,      
                subscriptionPrice: updatedTotalPrice 
            });

            alert("تم تعديل بيانات الشركة بنجاح واحتساب إجمالي القيمة الجديدة!");

            const modalElement = document.getElementById('editCompanyModal');
            const modal = bootstrap.Modal.getInstance(modalElement);
            modal.hide();
        }
    } catch (error) {
        console.error("Error updating company: ", error);
        alert("حدث خطأ أثناء التعديل.");
    }
});

// استدعاء دالة التحميل عند فتح الصفحة لأول مرة
document.addEventListener("DOMContentLoaded", () => {
    loadCompanies('init');
    displayAdminProfile();
});

// التقاط الـ Form لتفعيل إضافة الشركة
document.getElementById("addCompanyForm").addEventListener("submit", async function (e) {
    e.preventDefault();

    const companyName = document.getElementById("companyName").value;
    const email = document.getElementById("companyEmail").value;
    const password = document.getElementById("companyPassword").value;
    const subPrice = document.getElementById("subPrice").value; 
    const subDuration = document.getElementById("subDuration").value;

    await addCompanyAccount(companyName, email, password, subPrice, subDuration);
    this.reset();
});

// ربط أزرار الـ Pagination بالتعديل الجديد المعتمد على الاتجاهات النصية
document.getElementById("nextBtn").addEventListener("click", () => {
    loadCompanies('next');
});

document.getElementById("prevBtn").addEventListener("click", () => {
    loadCompanies('prev');
});

window.deleteCompany = deleteCompany;
window.renewSubscription = renewSubscription;

// استدعاء دالة التحميل الذكية وربط زرار تسجيل الخروج عند فتح صفحة إدارة الشركات
document.addEventListener("DOMContentLoaded", () => {
    // 1. تشغيل جدول الشركات (هنا بنشغل اللود مش التحليلات)
    loadCompanies('init');
    displayAdminProfile();
    
    // 2. تفعيل زرار تسجيل الخروج
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {
            alert("تم تسجيل الخروج بنجاح");
            window.location.href = "../auth.html";
        });
    }
});

// دالة جلب وعرض اسم الأدمن الحالي
function displayAdminProfile() {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            try {
                // جلب مستند الأدمن باستخدام الـ UID الخاص به
                const adminRef = doc(db, "users", user.uid);
                const adminSnap = await getDoc(adminRef);

                if (adminSnap.exists()) {
                    const adminData = adminSnap.data();
                    // قراءة الحقل name كما هو في الفايربيز عندك
                    const fullAdminName = adminData.name || adminData.fullName || "المسؤول";

                    // تحديث واجهة المستخدم
                    const nameElem = document.getElementById("adminName");
                    const avatarElem = document.getElementById("adminAvatar");

                    if (nameElem) {
                        nameElem.innerText = fullAdminName;
                    }
                    if (avatarElem) {
                        // أخذ أول حرف من الاسم وعرضه كـ الكابيتال
                        avatarElem.innerText = fullAdminName.charAt(0).toUpperCase();
                    }
                }
            } catch (error) {
                console.error("Error fetching admin profile:", error);
            }
        } else {
            // لو مفيش مستخدم مسجل دخول، يرجعه لصفحة الدخول فوراً لحماية اللوحة
            window.location.href = "../auth.html";
        }
    });
}