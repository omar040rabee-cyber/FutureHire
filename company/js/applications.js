import { db } from '../../js/firebase-config.js';
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    collection, doc, query, where, onSnapshot, getDoc, updateDoc 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const auth = getAuth();
let currentCompanyId = null;

// متغيرات التحكم في الصفحات (Pagination)
let allApplications = [];
let currentPage = 1;
const rowsPerPage = 5; // عدد الطلبات المعروضة في الصفحة الواحدة

// عناصر الواجهة (DOM Elements)
const tableBody = document.getElementById("applications-table");
const prevBtn = document.getElementById("app-prev-btn");
const nextBtn = document.getElementById("app-next-btn");
const pageInfo = document.getElementById("app-page-info");

// ==========================================
// 1. التحقق من هوية الشركة وتحديث شريط التنقل
// ==========================================
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentCompanyId = user.uid;
        try {
            const companyRef = doc(db, "users", user.uid);
            const companySnap = await getDoc(companyRef);

            if (companySnap.exists()) {
                const companyData = companySnap.data();
                const name = companyData.fullName || companyData.name || "الشركة";
                
                document.getElementById("companyName").innerText = name;
                document.getElementById("companyAvatar").innerText = name.charAt(0).toUpperCase();
                
                // تشغيل جلب الطلبات فوراً
                listenToIncomingApplications();
            }
        } catch (error) {
            console.error("خطأ في تحميل ملف الشركة:", error);
        }
    } else {
        window.location.href = "../auth.html";
    }
});

// ==========================================
// 2. الاستماع اللحظي لطلبات التقديم الواردة
// ==========================================
function listenToIncomingApplications() {
    const appsQuery = query(
        collection(db, "applications"), 
        where("companyId", "==", currentCompanyId)
    );

    onSnapshot(appsQuery, (snapshot) => {
        allApplications = [];
        
        snapshot.forEach((doc) => {
            const appData = doc.data();
            appData.id = doc.id; // حفظ الـ ID الخاص بالطلب لتحديثه لاحقاً
            allApplications.push(appData);
        });

        // ترتيب الطلبات (الحديث أولاً إذا كان حقل التاريخ متوفر)
        // allApplications.sort((a, b) => b.createdAt - a.createdAt);

        // إعادة عرض الجدول بناءً على البيانات الجديدة
        renderApplicationsTable();
    }, (error) => {
        console.error("حدث خطأ أثناء جلب الطلبات:", error);
        tableBody.innerHTML = `<tr><td colspan="7" class="text-center text-danger py-4">حدث خطأ أثناء تحميل البيانات.</td></tr>`;
    });
}

// ==========================================
// 3. رندرة الجدول والتحكم بنظام الصفحات
// ==========================================
function renderApplicationsTable() {
    if (allApplications.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-4">لا توجد طلبات تقديم واردة حتى الآن.</td></tr>`;
        updatePaginationControls(0);
        return;
    }

    // حسابات الصفحات
    const totalPages = Math.ceil(allApplications.length / rowsPerPage);
    if (currentPage > totalPages) currentPage = totalPages || 1;

    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    const paginatedItems = allApplications.slice(startIndex, endIndex);

    // بناء سطور الجدول
    let rowsHTML = "";
    paginatedItems.forEach(app => {
        rowsHTML += `
            <tr>
                <td class="fw-bold text-dark">${app.applicantName || app.name || 'غير معروف'}</td>
                <td><span class="badge bg-primary-subtle text-primary border border-primary-subtle px-2 py-1">${app.jobTitle || 'وظيفة مطروحة'}</span></td>
                <td><a href="mailto:${app.applicantEmail}" class="text-decoration-none small text-muted"><i class="bi bi-envelope me-1"></i>${app.applicantEmail || 'لا يوجد'}</a></td>
                <td>
                    ${app.linkedin || app.linkedInUrl ? 
                        `<a href="${app.linkedin || app.linkedInUrl}" target="_blank" class="btn btn-sm btn-link text-info p-0 fs-5"><i class="bi bi-linkedin"></i></a>` 
                        : `<span class="text-muted small">-</span>`}
                </td>
                <td>
                    ${app.cvUrl || app.resume ? 
                        `<a href="${app.cvUrl || app.resume}" target="_blank" class="btn btn-sm btn-outline-secondary py-1 px-2 rounded-2 small"><i class="bi bi-file-earmark-pdf-fill text-danger me-1"></i>عرض الـ CV</a>` 
                        : `<span class="text-muted small">لم يرفق</span>`}
                </td>
                <td>${getStatusBadge(app.status)}</td>
                <td class="text-center">
                    ${app.status === 'pending' || !app.status || app.status === 'قيد المراجعة' ? `
                        <div class="d-flex justify-content-center gap-1">
                            <button onclick="handleAction('${app.id}', 'accepted')" class="btn btn-sm btn-success d-flex align-items-center gap-1 py-1 px-2"><i class="bi bi-check-lg"></i> قبول</button>
                            <button onclick="handleAction('${app.id}', 'rejected')" class="btn btn-sm btn-outline-danger d-flex align-items-center gap-1 py-1 px-2"><i class="bi bi-x-lg"></i> رفض</button>
                        </div>
                    ` : `<span class="text-muted small fw-medium">تم اتخاذ إجراء</span>`}
                </td>
            </tr>
        `;
    });

    tableBody.innerHTML = rowsHTML;
    updatePaginationControls(totalPages);
}

// دالة مساعدة لإنشاء بادج الحالة بألوان متناسقة
function getStatusBadge(status) {
    const currentStatus = status ? status.toLowerCase() : 'pending';
    switch(currentStatus) {
        case 'accepted':
        case 'مقبول':
            return `<span class="badge bg-success-subtle text-success px-2 py-1"><i class="bi bi-check-circle-fill me-1"></i> مقبول للمقابلة</span>`;
        case 'rejected':
        case 'مرفوض':
            return `<span class="badge bg-danger-subtle text-danger px-2 py-1"><i class="bi bi-x-circle-fill me-1"></i> مرفوض</span>`;
        default:
            return `<span class="badge bg-warning-subtle text-warning px-2 py-1"><i class="bi bi-hourglass-split me-1"></i> قيد المراجعة</span>`;
    }
}

// تحديث أزرار التنقل (السابق / التالي)
function updatePaginationControls(totalPages) {
    pageInfo.innerText = `الصفحة ${currentPage} من ${totalPages || 1}`;
    prevBtn.disabled = currentPage === 1 || totalPages === 0;
    nextBtn.disabled = currentPage === totalPages || totalPages === 0;
}

// إعداد أحداث الضغط على أزرار الصفحات
prevBtn.addEventListener("click", () => {
    if (currentPage > 1) {
        currentPage--;
        renderApplicationsTable();
    }
});

nextBtn.addEventListener("click", () => {
    const totalPages = Math.ceil(allApplications.length / rowsPerPage);
    if (currentPage < totalPages) {
        currentPage++;
        renderApplicationsTable();
    }
});

// ==========================================
// 4. دالة معالجة القبول والرفض وتحديث الفايربيز
// ==========================================
window.handleAction = async function(appId, newStatus) {
    const actionText = newStatus === 'accepted' ? 'قبول هذا المتقدم للمقابلة؟' : 'رفض هذا الطلب؟';
    if (!confirm(`هل أنت متأكد من ${actionText}`)) return;

    try {
        const appRef = doc(db, "applications", appId);
        await updateDoc(appRef, {
            status: newStatus,
            actionDate: new Date() // تسجيل وقت اتخاذ القرار للتوثيق
        });
        // لا نحتاج لاستدعاء أي دالة تحديث هنا، لأن الـ onSnapshot هيحدث الجدول تلقائياً فورا!
    } catch (error) {
        console.error("خطأ أثناء تحديث حالة الطلب:", error);
        alert("عذراً، فشل تحديث حالة الطلب. حاول مرة أخرى.");
    }
};

// ==========================================
// 5. زر تسجيل الخروج
// ==========================================
document.getElementById("logoutBtn").addEventListener("click", () => {
    alert("تم تسجيل الخروج بنجاح");
    window.location.href = "../auth.html";
});