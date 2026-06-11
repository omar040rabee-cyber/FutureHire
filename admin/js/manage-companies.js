import { db } from '../../js/firebase-config.js';
import { 
    collection, addDoc, doc, updateDoc, deleteDoc, query, where, limit, startAfter, onSnapshot 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// دالة إضافة حساب شركة جديد بواسطة الأدمن
export async function addCompanyAccount(companyName, email, password, subscriptionPrice, subscriptionDurationMonths) {
    try {
        const startDate = new Date();
        const expiryDate = new Date();
        expiryDate.setMonth(startDate.getMonth() + parseInt(subscriptionDurationMonths));

        await addDoc(collection(db, "users"), {
            fullName: companyName,
            email: email,
            role: "company",
            subscriptionStatus: "active",
            subscriptionPrice: parseFloat(subscriptionPrice),
            createdAt: startDate.toISOString(),
            expiryDate: expiryDate.toISOString()
        });

        alert("تم إضافة حساب الشركة وتفعيل الاشتراك بنجاح!");
        // لا داعي لاستدعاء loadCompanies() هنا، لأن onSnapshot سيحدث الجدول تلقائياً
    } catch (error) {
        console.error("Error adding company: ", error);
        alert("حدث خطأ: " + error.message);
    }
}

// دالة حذف شركة
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

// دالة تجديد الاشتراك للشركات المنتهية
export async function renewSubscription(companyId, additionalMonths) {
    try {
        const companyRef = doc(db, "users", companyId);
        const newExpiryDate = new Date();
        newExpiryDate.setMonth(newExpiryDate.getMonth() + parseInt(additionalMonths));

        await updateDoc(companyRef, {
            subscriptionStatus: "active",
            expiryDate: newExpiryDate.toISOString()
        });

        alert("تم تجديد الاشتراك بنجاح!");
    } catch (error) {
        console.error("Error renewing subscription: ", error);
    }
}

// ==========================================
// نظام الـ Pagination للشركات مع التحديث اللحظي
// ==========================================
let lastVisibleCompany = null;
const PAGE_SIZE = 5;
let unsubscribe = null; // لتخزين مستمع التغيرات وإيقافه عند التنقل بين الصفحات

export async function loadCompanies(isNext = true) {
    let q;
    if (!lastVisibleCompany) {
        q = query(collection(db, "users"), where("role", "==", "company"), limit(PAGE_SIZE));
    } else if (isNext) {
        q = query(collection(db, "users"), where("role", "==", "company"), startAfter(lastVisibleCompany), limit(PAGE_SIZE));
    } else {
        q = query(collection(db, "users"), where("role", "==", "company"), limit(PAGE_SIZE));
    }

    // إيقاف المستمع القديم لتجنب التداخل
    if (unsubscribe) {
        unsubscribe();
    }

    // الاستماع للتغيرات لحظياً على البيانات المجلوبة
    unsubscribe = onSnapshot(q, (snapshot) => {
        const tbody = document.getElementById("companiesTableBody");
        
        if (snapshot.empty) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center">لا توجد شركات لعرضها.</td></tr>`;
            return;
        }

        // حفظ مرجع لآخر عنصر للصفحة التالية
        lastVisibleCompany = snapshot.docs[snapshot.docs.length - 1];
        tbody.innerHTML = "";

        const today = new Date();

        snapshot.forEach((doc) => {
            const company = doc.data();
            const expiryDate = new Date(company.expiryDate);

            // حساب الفرق بالأيام
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
                renewButton = `---`;
            }

            const formattedExpiry = expiryDate.toLocaleDateString('ar-EG');

            tbody.innerHTML += `
                <tr>
                    <td>${company.fullName}</td>
                    <td>${company.email}</td>
                    <td>${company.subscriptionPrice} ج.م</td>
                    <td>${formattedExpiry}</td>
                    <td>${statusBadge}</td>
                    <td>
                        ${renewButton}
                        <button class="btn btn-sm btn-info ms-1" onclick="openEditModal('${doc.id}', '${company.fullName}', '${company.email}', '${company.subscriptionPrice}')">تعديل</button>
                        <button class="btn btn-sm btn-danger ms-1" onclick="deleteCompany('${doc.id}')">حذف</button>
                    </td>
                </tr>
            `;
        });
    }, (error) => {
        console.error("Error in snapshot listener: ", error);
    });
}

// 1. فتح نافذة التعديل وملء البيانات القديمة
window.openEditModal = function (id, name, email, price) {
    document.getElementById("editCompanyId").value = id;
    document.getElementById("editCompanyName").value = name;
    document.getElementById("editCompanyEmail").value = email;
    document.getElementById("editSubPrice").value = price;

    const editModal = new bootstrap.Modal(document.getElementById('editCompanyModal'));
    editModal.show();
}

// 2. حفظ التعديلات في Firebase عند إرسال النموذج
document.getElementById("editCompanyForm").addEventListener("submit", async function (e) {
    e.preventDefault();

    const companyId = document.getElementById("editCompanyId").value;
    const newName = document.getElementById("editCompanyName").value;
    const newEmail = document.getElementById("editCompanyEmail").value;
    const newPrice = parseFloat(document.getElementById("editSubPrice").value);

    try {
        const companyRef = doc(db, "users", companyId);
        await updateDoc(companyRef, {
            fullName: newName,
            email: newEmail,
            subscriptionPrice: newPrice
        });

        alert("تم تعديل بيانات الشركة بنجاح!");

        const modalElement = document.getElementById('editCompanyModal');
        const modal = bootstrap.Modal.getInstance(modalElement);
        modal.hide();
        
        // سيتم تحديث الجدول لحظياً بفضل onSnapshot
    } catch (error) {
        console.error("Error updating company: ", error);
        alert("حدث خطأ أثناء التعديل.");
    }
});

// استدعاء دالة التحميل عند فتح الصفحة لأول مرة
document.addEventListener("DOMContentLoaded", () => {
    loadCompanies(true);
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

// ربط أزرار الـ Pagination
document.getElementById("nextBtn").addEventListener("click", () => {
    loadCompanies(true);
});

document.getElementById("prevBtn").addEventListener("click", () => {
    loadCompanies(false);
});

// إتاحة الدوال للعمل داخل الـ onclick في الـ HTML
window.deleteCompany = deleteCompany;
window.renewSubscription = renewSubscription;