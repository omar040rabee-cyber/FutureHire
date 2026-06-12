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
let applicantCountListeners = {}; 

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
                
                loadCompanyJobs('init');
            }
        } catch (error) {
            console.error("Error fetching company details:", error);
        }
    } else {
        window.location.href = "../auth.html";
    }
});

// ==========================================
// 2. دالة إضافة وظيفة جديدة مع تحويل المهارات لمصفوفة
// ==========================================
document.getElementById("addJobForm").addEventListener("submit", async function (e) {
    e.preventDefault();

    if (!currentCompanyId) return;

    // تحويل النص المدخل في السكيلز إلى مصفوفة نظيفة بدون مسافات زائدة
    const skillsInput = document.getElementById("jobSkills").value;
    const skillsArray = skillsInput.split(',').map(s => s.trim()).filter(s => s !== "");

    const jobData = {
        title: document.getElementById("jobTitle").value,
        department: document.getElementById("jobDepartment").value,
        type: document.getElementById("jobType").value,
        salary: parseFloat(document.getElementById("jobSalary").value),
        location: document.getElementById("jobLocation").value,
        skills: skillsArray, // حفظ المهارات كـ Array في الفايربيز
        description: document.getElementById("jobDescription").value,
        companyId: currentCompanyId,
        status: "active", 
        createdAt: new Date().toISOString()
    };

    try {
        await addDoc(collection(db, "jobs"), jobData);
        alert("تم نشر الوظيفة الجديدة في السوق بنجاح!");
        this.reset();
    } catch (error) {
        console.error("Error adding job: ", error);
        alert("حدث خطأ أثناء إضافة الوظيفة.");
    }
});

// ==========================================
// 3. نظام جلب البيانات الفوري وعرض بادجات المهارات
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

    Object.values(applicantCountListeners).forEach(unsub => unsub());
    applicantCountListeners = {};

    unsubscribeJobs = onSnapshot(q, (snapshot) => {
        const tbody = document.getElementById("jobsTableBody");
        const nextBtn = document.getElementById("nextBtn");
        const prevBtn = document.getElementById("prevBtn");
        
        if (snapshot.empty) {
            tbody.innerHTML = `<tr><td colspan="7" class="py-4 text-muted">لا توجد وظائف منشورة حالياً.</td></tr>`;
            if (nextBtn) nextBtn.disabled = true;
            if (prevBtn) prevBtn.disabled = true;
            return;
        }

        pageStack[currentPageIndex] = snapshot.docs[0];
        tbody.innerHTML = "";

        const docsToDisplay = snapshot.docs.slice(0, PAGE_SIZE);
        lastVisibleJob = docsToDisplay[docsToDisplay.length - 1];

        docsToDisplay.forEach((docSnap) => {
            const job = docSnap.data();
            const jobId = docSnap.id;
            const dateFormatted = new Date(job.createdAt).toLocaleDateString('ar-EG');
            
            const jobStatus = job.status || "active"; 
            const isPaused = jobStatus === "paused";
            
            const statusBadge = isPaused 
                ? `<span class="badge bg-warning text-dark"><i class="bi bi-pause-circle-fill me-1"></i> موقوفة</span>`
                : `<span class="badge bg-success"><i class="bi bi-check-circle-fill me-1"></i> نشطة</span>`;

            const toggleButton = isPaused
                ? `<button class="btn btn-sm btn-outline-success me-1" onclick="toggleJobStatus('${jobId}', 'active')"><i class="bi bi-play-fill"></i></button>`
                : `<button class="btn btn-sm btn-outline-warning me-1" onclick="toggleJobStatus('${jobId}', 'paused')"><i class="bi bi-pause-fill"></i></button>`;

            // تحويل مصفوفة المهارات لبادجات HTML صغيرة تحت اسم الوظيفة
            const skillsBadges = (job.skills || []).map(skill => 
                `<span class="badge bg-light text-primary border border-primary-subtle me-1 mt-1" style="font-size: 0.75rem;">${skill}</span>`
            ).join('');

            // تجهيز نص المهارات مدمج بـ فاصلة لإرساله للمودال عند التعديل بأمان
            const skillsEscapedString = (job.skills || []).join(', ');

            tbody.innerHTML += `
                <tr>
                    <td class="text-start ps-3">
                        <div class="fw-bold text-dark fs-6">${job.title}</div>
                        <div class="d-flex flex-wrap mt-1">${skillsBadges || '<small class="text-muted">لم تحدد مهارات</small>'}</div>
                    </td>
                    <td><span class="badge bg-light text-secondary border px-2 py-1">${job.department}</span></td>
                    <td><span class="badge bg-primary-subtle text-primary border border-primary-subtle px-3 py-1">${job.type}</span></td>
                    <td><span id="count-${jobId}" class="badge bg-dark rounded-pill px-3 py-1.5 fw-bold">0</span></td>
                    <td>${statusBadge}</td>
                    <td>${dateFormatted}</td>
                    <td>
                        <div class="d-flex justify-content-center">
                            ${toggleButton}
                            <button class="btn btn-sm btn-outline-info me-1" onclick="openEditJobModal('${jobId}', '${job.title}', '${job.department}', '${job.type}', '${job.salary}', '${job.location}', \`${job.description.replace(/`/g, '\\`').replace(/\n/g, '\\n')}\`, '${skillsEscapedString}')"><i class="bi bi-pencil"></i></button>
                            <button class="btn btn-sm btn-outline-danger" onclick="deleteJob('${jobId}')"><i class="bi bi-trash"></i></button>
                        </div>
                    </td>
                </tr>
            `;

            const appQuery = query(collection(db, "applications"), where("jobId", "==", jobId));
            applicantCountListeners[jobId] = onSnapshot(appQuery, (appSnapshot) => {
                const countElem = document.getElementById(`count-${jobId}`);
                if (countElem) {
                    countElem.innerText = appSnapshot.size;
                }
            }, (err) => console.error("Error fetching applicants count:", err));
        });

        if (nextBtn) nextBtn.disabled = snapshot.docs.length <= PAGE_SIZE;
        if (prevBtn) prevBtn.disabled = currentPageIndex === 0;

    }, (error) => {
        console.error("Error streaming jobs: ", error);
    });
}

// ==========================================
// 4. دالة الإيقاف المؤقت أو إعادة التفعيل
// ==========================================
window.toggleJobStatus = async function (jobId, newStatus) {
    const msg = newStatus === 'paused' 
        ? "هل أنت متأكد من إيقاف نشر الوظيفة مؤقتاً؟" 
        : "هل تريد إعادة تفعيل نشر الوظيفة في سوق العمل مجدداً؟";

    if (confirm(msg)) {
        try {
            await updateDoc(doc(db, "jobs", jobId), { status: newStatus });
            alert("تم تحديث حالة النشر بنجاح!");
        } catch (error) {
            console.error("Error toggling job status: ", error);
        }
    }
}

// ==========================================
// 5. فتح الـ Modal وتعبئة الحقول بما فيها السكيلز كـ نص كومة
// ==========================================
window.openEditJobModal = function (id, title, dept, type, salary, location, desc, skillsString) {
    document.getElementById("editJobId").value = id;
    document.getElementById("editJobTitle").value = title;
    document.getElementById("editJobDepartment").value = dept;
    document.getElementById("editJobType").value = type;
    document.getElementById("editJobSalary").value = salary;
    document.getElementById("editJobLocation").value = location;
    document.getElementById("editJobDescription").value = desc;
    document.getElementById("editJobSkills").value = skillsString; // تعبئة حقل المهارات المعدل

    const editModal = new bootstrap.Modal(document.getElementById('editJobModal'));
    editModal.show();
}

// ==========================================
// 6. حفظ تعديلات بيانات الوظيفة والمهارات المحولة
// ==========================================
document.getElementById("editJobForm").addEventListener("submit", async function (e) {
    e.preventDefault();

    const jobId = document.getElementById("editJobId").value;
    const skillsInput = document.getElementById("editJobSkills").value;
    const skillsArray = skillsInput.split(',').map(s => s.trim()).filter(s => s !== "");
    
    const updatedData = {
        title: document.getElementById("editJobTitle").value,
        department: document.getElementById("editJobDepartment").value,
        type: document.getElementById("editJobType").value,
        salary: parseFloat(document.getElementById("editJobSalary").value),
        location: document.getElementById("editJobLocation").value,
        skills: skillsArray, // تحديث المصفوفة في الفايربيز
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
// 7. دالة الحذف النهائي للوظيفة
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
// 8. ربط أزرار الـ Pagination وتسجيل الخروج
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