import { db } from '../../js/firebase-config.js';  
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, doc, query, where, onSnapshot, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const auth = getAuth();
let currentCompanyId = null;

const tableBody = document.getElementById("accepted-table-body");

// ==========================================
// 1. التحقق من هوية الشركة وتحديث الهيدر
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
                
                // تحديث اسم الأفاتار واسم الشركة في الـ Navbar
                document.getElementById("companyName").innerText = name;
                document.getElementById("companyAvatar").innerText = name.charAt(0).toUpperCase();
                
                // بدء الاستماع للمرشحين المقبولين فقط
                listenToAcceptedCandidates();
            }
        } catch (error) {
            console.error("خطأ في جلب بيانات الشركة:", error);
        }
    } else {
        // إذا لم يكن مسجلاً، يتم توجيهه لصفحة تسجيل الدخول
        window.location.href = "../auth.html";
    }
});

// ==========================================
// 2. الاستماع الفوري لقائمة المقبولين فقط (Realtime)
// ==========================================
function listenToAcceptedCandidates() {
    // كويري يجلب فقط الطلبات الخاصة بهذه الشركة والتي حالتها 'accepted'
    const acceptedQuery = query(
        collection(db, "applications"), 
        where("companyId", "==", currentCompanyId),
        where("status", "==", "accepted")
    );

    onSnapshot(acceptedQuery, (snapshot) => {
        if (snapshot.empty) {
            tableBody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">لا يوجد أي مرشحين مقبولين للمقابلات حتى الآن.</td></tr>`;
            return;
        }

        let rowsHTML = "";
        snapshot.forEach((doc) => {
            const candidate = doc.data();
            
            rowsHTML += `
                <tr>
                    <td class="fw-bold text-dark">${candidate.applicantName || candidate.name || 'غير معروف'}</td>
                    <td><span class="badge bg-primary-subtle text-primary border border-primary-subtle px-2 py-1">${candidate.jobTitle || 'وظيفة مطروحة'}</span></td>
                    <td><a href="tel:${candidate.applicantPhone || '#'}" class="text-decoration-none text-secondary small"><i class="bi bi-telephone me-1"></i>${candidate.applicantPhone || candidate.phone || 'غير متوفر'}</a></td>
                    <td><a href="mailto:${candidate.applicantEmail}" class="text-decoration-none text-secondary small"><i class="bi bi-envelope me-1"></i>${candidate.applicantEmail || 'لا يوجد'}</a></td>
                    <td>
                        ${candidate.cvUrl || candidate.resume ? 
                            `<a href="${candidate.cvUrl || candidate.resume}" target="_blank" class="btn btn-sm btn-outline-success py-1 px-2 rounded-2 small"><i class="bi bi-file-earmark-pdf-fill text-danger me-1"></i>فتح السيرة الذاتية</a>` 
                            : `<span class="text-muted small">لم يرفق</span>`}
                    </td>
                    <td>
                        <span class="badge bg-success px-2 py-1 rounded-3"><i class="bi bi-calendar-check me-1"></i> جاهز للمقابلة</span>
                    </td>
                </tr>
            `;
        });

        tableBody.innerHTML = rowsHTML;
    }, (error) => {
        console.error("حدث خطأ أثناء جلب المقبولين:", error);
        tableBody.innerHTML = `<tr><td colspan="6" class="text-center text-danger py-4">حدث خطأ أثناء تحميل البيانات.</td></tr>`;
    });
}

// ==========================================
// 3. زر تسجيل الخروج
// ==========================================
document.getElementById("logoutBtn").addEventListener("click", () => {
    alert("تم تسجيل الخروج بنجاح");
    window.location.href = "../auth.html";
});