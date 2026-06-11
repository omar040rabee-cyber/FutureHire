import { db } from '../../js/firebase-config.js'; 
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    collection, addDoc, doc, updateDoc, deleteDoc, query, where, limit, startAfter, startAt, onSnapshot, getDoc 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const auth = getAuth();
let currentCompanyId = null;

// إعدادات الـ Pagination
const PAGE_SIZE = 5;
let pageStack = [];          
let currentPageIndex = 0;    
let lastVisibleJob = null;
let unsubscribeJobs = null; 

// ==========================================
// 1. مراقبة حالة تسجيل الدخول وتحديث الملف الشخصي
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
                
                // تشغيل جلب الوظائف التابعة لهذه الشركة فقط فور التأكد من الـ UID
                loadCompanyJobs('init');
            }
        } catch (error) {
            console.error("Error fetching company details:", error);
        }
    } else {
        // حماية الصفحة: إذا لم يسجل دخول يتم توجيهه لصفحة الدخول
        window.location.href = "../auth.html";
    }
});

// ==========================================
// 2. دالة إضافة وظيفة جديدة للشركة الحالية
// ==========================================
document.getElementById("addJobForm").addEventListener("submit", async function (e) {
    e.preventDefault();

    if (!currentCompanyId) return;

    const jobData = {
        title: document.getElementById("jobTitle").value,
        department: document.getElementById("jobDepartment").value,
        type: document.getElementById("jobType").value,
        salary: parseFloat(document.getElementById("jobSalary").value),
        location: document.getElementById("jobLocation").value,
        description: document.getElementById("jobDescription").value,
        companyId: currentCompanyId, // ربط الوظيفة بالشركة الحالية بالملي
        createdAt: new Date().toISOString()
    };

    try {
        await addDoc(collection(db, "jobs"), jobData);
        alert("تم نشر الوظيفة الجديدة بنجاح!");
        this.reset();
    } catch (error) {
        console.error("Error adding job: ", error);
        alert("حدث خطأ أثناء إضافة الوظيفة.");
    }
});

// ==========================================
// 3. نظام جلب البيانات الفوري مع الـ Pagination الذكي
// ==========================================
export async function loadCompanyJobs(direction = 'init') {
    if (!currentCompanyId) return;
    
    let q;
    
    if (direction === 'next') {
        currentPageIndex++;
        q = query(collection(db, "jobs"), where("companyId", "==", currentCompanyId), startAfter(lastVisibleJob), limit(PAGE_SIZE + 1));
    } else if (direction === 'prev') {
        currentPageIndex--;
        const firstDocOfPage = pageStack[currentPageIndex];
        q = query(collection(db, "jobs"), where("companyId", "==", currentCompanyId), startAt(firstDocOfPage), limit(PAGE_SIZE + 1));
    } else {
        currentPageIndex = 0;
        pageStack = [];
        q = query(collection(db, "jobs"), where("companyId", "==", currentCompanyId), limit(PAGE_SIZE + 1));
    }

    if (unsubscribeJobs) {
        unsubscribeJobs();
    }

    unsubscribeJobs = onSnapshot(q, (snapshot) => {
        const tbody = document.getElementById("jobsTableBody");
        const nextBtn = document.getElementById("nextBtn");
        const prevBtn = document.getElementById("prevBtn");
        
        if (snapshot.empty) {
            tbody.innerHTML = `<tr><td colspan="6" class="py-4 text-muted">لا توجد وظائف منشورة حالياً.</td></tr>`;
            if (nextBtn) nextBtn.disabled = true;
            if (prevBtn) prevBtn.disabled = true;
            return;
        }

        // تخزين المستند الأول للصفحة للعودة الآمنة
        pageStack[currentPageIndex] = snapshot.docs[0];

        tbody.innerHTML = "";
        const docsToDisplay = snapshot.docs.slice(0, PAGE_SIZE);
        lastVisibleJob = docsToDisplay[docsToDisplay.length - 1];

        docsToDisplay.forEach((docSnap) => {
            const job = docSnap.data();
            const dateFormatted = new Date(job.createdAt).toLocaleDateString('ar-EG');

            tbody.innerHTML += `
                <tr>
                    <td class="fw-bold text-dark">${job.title}</td>
                    <td><span class="badge bg-light text-secondary border px-2 py-1">${job.department}</span></td>
                    <td><span class="badge bg-primary-subtle text-primary border border-primary-subtle px-3 py-1">${job.type}</span></td>
                    <td class="text-success fw-medium">${job.salary} ج.م</td>
                    <td>${dateFormatted}</td>
                    <td>
                        <button class="btn btn-sm btn-outline-info me-1" onclick="openEditJobModal('${docSnap.id}', '${job.title}', '${job.department}', '${job.type}', '${job.salary}', '${job.location}', \`${job.description.replace(/`/g, '\\`').replace(/\n/g, '\\n')}\`)"><i class="bi bi-pencil"></i> تعديل</button>
                        <button class="btn btn-sm btn-outline-danger" onclick="deleteJob('${docSnap.id}')"><i class="bi bi-trash"></i> حذف</button>
                    </td>
                </tr>
            `;
        });

        // تشغيل أزرار التنقل الذكية بحسب الـ PAGE_SIZE + 1
        if (nextBtn) nextBtn.disabled = snapshot.docs.length <= PAGE_SIZE;
        if (prevBtn) prevBtn.disabled = currentPageIndex === 0;

    }, (error) => {
        console.error("Error streaming jobs: ", error);
    });
}

// ==========================================
// 4. فتح الـ Modal وتعبئة حقول تعديل الوظيفة
// ==========================================
window.openEditJobModal = function (id, title, dept, type, salary, location, desc) {
    document.getElementById("editJobId").value = id;
    document.getElementById("editJobTitle").value = title;
    document.getElementById("editJobDepartment").value = dept;
    document.getElementById("editJobType").value = type;
    document.getElementById("editJobSalary").value = salary;
    document.getElementById("editJobLocation").value = location;
    document.getElementById("editJobDescription").value = desc;

    const editModal = new bootstrap.Modal(document.getElementById('editJobModal'));
    editModal.show();
}

// ==========================================
// 5. حفظ تعديلات بيانات الوظيفة
// ==========================================
document.getElementById("editJobForm").addEventListener("submit", async function (e) {
    e.preventDefault();

    const jobId = document.getElementById("editJobId").value;
    
    const updatedData = {
        title: document.getElementById("editJobTitle").value,
        department: document.getElementById("editJobDepartment").value,
        type: document.getElementById("editJobType").value,
        salary: parseFloat(document.getElementById("editJobSalary").value),
        location: document.getElementById("editJobLocation").value,
        description: document.getElementById("editJobDescription").value
    };

    try {
        await updateDoc(doc(db, "jobs", jobId), updatedData);
        alert("تم تحديث بيانات الوظيفة بنجاح!");
        
        const modalElement = document.getElementById('editJobModal');
        const modal = bootstrap.Modal.getInstance(modalElement);
        modal.hide();
    } catch (error) {
        console.error("Error updating job: ", error);
        alert("حدث خطأ أثناء التعديل.");
    }
});

// ==========================================
// 6. دالة حذف الوظيفة
// ==========================================
window.deleteJob = async function (jobId) {
    if (confirm("هل أنت متأكد من حذف هذه الوظيفة نهائياً؟")) {
        try {
            await deleteDoc(doc(db, "jobs", jobId));
            alert("تم حذف الوظيفة بنجاح.");
        } catch (error) {
            console.error("Error deleting job: ", error);
        }
    }
}

// ==========================================
// 7. ربط أزرار الـ Pagination وتسجيل الخروج عند الـ Load
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("nextBtn").addEventListener("click", () => loadCompanyJobs('next'));
    document.getElementById("prevBtn").addEventListener("click", () => loadCompanyJobs('prev'));

    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {
            alert("تم تسجيل الخروج بنجاح");
            window.location.href = "../auth.html";
        });
    }
});