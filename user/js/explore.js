import { db } from '../../js/firebase-config.js'; 
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, getDocs, doc, getDoc, addDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const auth = getAuth();
let currentUser = null;

let allJobs = []; 
let currentFilteredJobs = []; 


let currentPage = 1;
const jobsPerPage = 6; 

const jobsContainer = document.getElementById("jobs-container");
const paginationContainer = document.getElementById("pagination-container");
const searchInput = document.getElementById("searchInput");
const filterType = document.getElementById("filterType");
const filterLocation = document.getElementById("filterLocation");
const logoutBtn = document.getElementById("logoutBtn");

// ==========================================
// 1. التحقق من هوية المستخدم وتشغيل النظام
// ==========================================
onAuthStateChanged(auth, async (user) => {
    if (user) {
        try {
            const userRef = doc(db, "users", user.uid);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
                currentUser = userSnap.data();
                currentUser.uid = user.uid;
            }
            fetchAllJobs();
        } catch (error) {
            console.error("حدث خطأ أثناء تحميل بيانات المستخدم:", error);
        }
    } else {
        window.location.href = "../auth.html";
    }
});

// ==========================================
// 2. جلب الوظائف وحفظها برمجياً
// ==========================================
// ==========================================
// 2. جلب الوظائف وربطها باسم الشركة مع نظام فحص أخطاء ذكي (Console Tracker)
// ==========================================
async function fetchAllJobs() {
    try {
        jobsContainer.innerHTML = `
            <div class="text-center w-100 py-5">
                <div class="spinner-border text-primary" role="status"></div>
                <p class="mt-2 text-muted">جاري تحميل الوظائف وجلب بيانات الشركات...</p>
            </div>`;
        
        const jobsSnapshot = await getDocs(collection(db, "jobs"));
        allJobs = []; 
        const companyCache = {};

        console.log("🔍 إجمالي عدد الوظائف المكتشفة في الفايربيز:", jobsSnapshot.size);

        for (const jobDoc of jobsSnapshot.docs) {
            const jobData = jobDoc.data();
            jobData.id = jobDoc.id; 

            // قراءة الـ companyId المتواجد داخل وثيقة الوظيفة
            const cId = jobData.companyId;
            console.log(`💼 تفحص وظيفة: "${jobData.title || jobData.jobTitle}" | ID الشركة المرتبط بها هو:`, cId);

            if (cId) {
                if (companyCache[cId]) {
                    jobData.companyName = companyCache[cId];
                    console.log(`⚡ تم جلب الاسم من الكاش فوراً: ${jobData.companyName}`);
                } else {
                    try {
                        const companyRef = doc(db, "users", cId);
                        const companySnap = await getDoc(companyRef);
                        
                        if (companySnap.exists()) {
                            const companyData = companySnap.data();
                            console.log(`✅ تم العثور على مستند الشركة بنجاح! البيانات هي:`, companyData);
                            
                            // استخدامfullName المتواجد في قاعدة بياناتك
                            jobData.companyName = companyData.fullName || "شركة بدون اسم";
                            companyCache[cId] = jobData.companyName;
                        } else {
                            console.warn(`⚠️ تحذير: المستند ${cId} غير موجود في مجموعة users!`);
                            jobData.companyName = "شركة غير مدرجة";
                        }
                    } catch (e) {
                        console.error(`❌ خطأ صلاحيات أو حماية أثناء قراءة مستند الشركة (Firestore Rules):`, e);
                        jobData.companyName = "شركة مسجلة"; 
                    }
                }
            } else {
                console.warn(`⚠️ تحذير: الوظيفة ${jobDoc.id} لا تحتوي على حقل companyId أصلاً!`);
                jobData.companyName = "شركة غير محددة";
            }

            allJobs.push(jobData);
        }

        setupDynamicFilters(allJobs);
        currentFilteredJobs = allJobs;
        currentPage = 1;
        renderJobsList(currentFilteredJobs);

    } catch (error) {
        console.error("❌ خطأ عام كارثي في دالة fetchAllJobs:", error);
        jobsContainer.innerHTML = `<div class="alert alert-danger text-center w-100">حدث خطأ أثناء تحميل الوظائف.</div>`;
    }
}

// ==========================================
// 4. دالة رندرة كروت الوظائف الثابتة والمنقحة
// ==========================================
function renderJobsList(jobsArray) {
    if (jobsArray.length === 0) {
        jobsContainer.innerHTML = `
            <div class="text-center w-100 py-5">
                <i class="bi bi-search fs-1 text-muted mb-2 d-block"></i>
                <p class="text-muted fs-5">لم نجد أي وظائف تطابق خيارات البحث الحالية.</p>
            </div>`;
        paginationContainer.innerHTML = ""; 
        return;
    }

    const startIndex = (currentPage - 1) * jobsPerPage;
    const endIndex = startIndex + jobsPerPage;
    const paginatedJobs = jobsArray.slice(startIndex, endIndex);

    let cardsHTML = "";
    paginatedJobs.forEach((job) => {
        // الاعتماد المباشر والكامل على الاسم المجلوب ديناميكياً
        const displayCompanyName = job.companyName || 'شركة مسجلة';

        let skillsHTML = "";
        if (job.skills) {
            const skillsArr = Array.isArray(job.skills) ? job.skills : job.skills.split(",");
            skillsHTML = `<div class="mb-3 d-flex flex-wrap gap-1">`;
            skillsArr.forEach(skill => {
                if (skill.trim()) {
                    skillsHTML += `<span class="badge bg-light text-dark border-0 small px-2 py-1" style="font-size: 0.75rem;"><i class="bi bi-lightning-charge text-warning me-1"></i>${skill.trim()}</span>`;
                }
            });
            skillsHTML += `</div>`;
        }

        cardsHTML += `
            <div class="col-md-6 col-lg-4 mb-4">
                <div class="card h-100 border-0 shadow-sm p-3">
                    <div class="card-body d-flex flex-column">
                        <div class="d-flex justify-content-between align-items-start mb-2">
                            <h5 class="card-title fw-bold text-primary mb-0">${job.title || job.jobTitle}</h5>
                            <span class="badge bg-light text-secondary border small">${job.type || job.jobType || 'دوام كامل'}</span>
                        </div>
                        
                        <h6 class="text-muted small mb-3"><i class="bi bi-building me-1"></i> ${displayCompanyName}</h6>
                        
                        <p class="card-text text-secondary small flex-grow-1 mb-2">
                            ${job.description ? job.description.substring(0, 120) + '...' : 'لا يوجد وصف تفصيلي للوظيفة حالياً.'}
                        </p>
                        
                        ${skillsHTML}
                        
                        <div class="mb-3">
                            <span class="text-muted small d-block mb-1"><i class="bi bi-geo-alt me-1"></i> ${job.location || 'غير محدد'}</span>
                            <span class="text-dark fw-bold small"><i class="bi bi-cash-stack me-1"></i> ${job.salary || 'غير محدد'} ج.م</span>
                        </div>

                        <button onclick="openApplyModal('${job.id}', '${job.title || job.jobTitle}', '${job.companyId || ''}', '${displayCompanyName}')" 
                                class="btn btn-primary w-100 rounded-3 fw-medium mt-auto">
                            <i class="bi bi-send me-1"></i> تقدم للوظيفة
                        </button>
                    </div>
                </div>
            </div>
        `;
    });

    jobsContainer.innerHTML = cardsHTML;
    renderPaginationControls(jobsArray.length);
}

// ==========================================
// 3. بناء الفلاتر ديناميكياً من الفايربيز
// ==========================================
function setupDynamicFilters(jobsArray) {
    const uniqueTypes = [...new Set(jobsArray.map(job => job.type || job.jobType).filter(Boolean))];
    const uniqueLocations = [...new Set(jobsArray.map(job => job.location).filter(Boolean))];

    filterType.innerHTML = '<option value="">كل أنواع الدوام</option>';
    uniqueTypes.forEach(type => {
        filterType.innerHTML += `<option value="${type}">${type}</option>`;
    });

    filterLocation.innerHTML = '<option value="">كل المواقع / المدن</option>';
    uniqueLocations.forEach(loc => {
        filterLocation.innerHTML += `<option value="${loc}">${loc}</option>`;
    });
}

// ==========================================
// 4. دالة رندرة كروت الوظائف (تمت إضافة المهارات واسم الشركة بوضوح)
// ==========================================
// function renderJobsList(jobsArray) {
//     if (jobsArray.length === 0) {
//         jobsContainer.innerHTML = `
//             <div class="text-center w-100 py-5">
//                 <i class="bi bi-search fs-1 text-muted mb-2 d-block"></i>
//                 <p class="text-muted fs-5">لم نجد أي وظائف تطابق خيارات البحث الحالية.</p>
//             </div>`;
//         paginationContainer.innerHTML = ""; 
//         return;
//     }

//     const startIndex = (currentPage - 1) * jobsPerPage;
//     const endIndex = startIndex + jobsPerPage;
//     const paginatedJobs = jobsArray.slice(startIndex, endIndex);

//     let cardsHTML = "";
//     paginatedJobs.forEach((job) => {
//         // تحويل المهارات إلى مصفوفة لعرضها بشكل جميل وثابت
//         let skillsHTML = "";
//         if (job.skills) {
//             const skillsArr = Array.isArray(job.skills) ? job.skills : job.skills.split(",");
//             skillsHTML = `<div class="mb-3 d-flex flex-wrap gap-1">`;
//             skillsArr.forEach(skill => {
//                 if (skill.trim()) {
//                     skillsHTML += `<span class="badge bg-light text-dark border-0 small px-2 py-1" style="font-size: 0.75rem;"><i class="bi bi-lightning-charge text-warning me-1"></i>${skill.trim()}</span>`;
//                 }
//             });
//             skillsHTML += `</div>`;
//         }

//         cardsHTML += `
//             <div class="col-md-6 col-lg-4 mb-4">
//                 <div class="card h-100 border-0 shadow-sm p-3">
//                     <div class="card-body d-flex flex-column">
//                         <div class="d-flex justify-content-between align-items-start mb-2">
//                             <h5 class="card-title fw-bold text-primary mb-0">${job.title || job.jobTitle}</h5>
//                             <span class="badge bg-light text-secondary border small">${job.type || job.jobType || 'دوام كامل'}</span>
//                         </div>
//                         <h6 class="text-muted small mb-3"><i class="bi bi-building me-1"></i> ${job.fullName || 'شركة مسجلة'}</h6>
                        
//                         <p class="card-text text-secondary small flex-grow-1 mb-2">
//                             ${job.description ? job.description.substring(0, 120) + '...' : 'لا يوجد وصف تفصيلي للوظيفة حالياً.'}
//                         </p>
                        
//                         ${skillsHTML}
                        
//                         <div class="mb-3">
//                             <span class="text-muted small d-block mb-1"><i class="bi bi-geo-alt me-1"></i> ${job.location || 'غير محدد'}</span>
//                             <span class="text-dark fw-bold small"><i class="bi bi-cash-stack me-1"></i> ${job.salary || 'غير محدد'} ج.م</span>
//                         </div>

//                         <button onclick="openApplyModal('${job.id}', '${job.title || job.jobTitle}', '${job.companyId}', '${job.fullName}')" 
//                                 class="btn btn-primary w-100 rounded-3 fw-medium mt-auto">
//                             <i class="bi bi-send me-1"></i> تقدم للوظيفة
//                         </button>
//                     </div>
//                 </div>
//             </div>
//         `;
//     });

//     jobsContainer.innerHTML = cardsHTML;
//     renderPaginationControls(jobsArray.length);
// }

// ==========================================
// 5. دالة بناء أزرار الترقيم
// ==========================================
function renderPaginationControls(totalItems) {
    const totalPages = Math.ceil(totalItems / jobsPerPage);

    if (totalPages <= 1) {
        paginationContainer.innerHTML = "";
        return;
    }

    let paginationHTML = "";

    paginationHTML += `
        <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
            <button class="btn btn-outline-primary btn-sm rounded-2 px-3" ${currentPage === 1 ? 'disabled' : ''} onclick="changePage(${currentPage - 1})">السابق</button>
        </li>
    `;

    for (let i = 1; i <= totalPages; i++) {
        paginationHTML += `
            <li class="page-item ${currentPage === i ? 'active' : ''}">
                <button class="btn ${currentPage === i ? 'btn-primary' : 'btn-outline-primary'} btn-sm rounded-2 px-3" onclick="changePage(${i})">${i}</button>
            </li>
        `;
    }

    paginationHTML += `
        <li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
            <button class="btn btn-outline-primary btn-sm rounded-2 px-3" ${currentPage === totalPages ? 'disabled' : ''} onclick="changePage(${currentPage + 1})">التالي</button>
        </li>
    `;

    paginationContainer.innerHTML = paginationHTML;
}

window.changePage = function(pageNumber) {
    currentPage = pageNumber;
    renderJobsList(currentFilteredJobs);
    window.scrollTo({ top: 300, behavior: 'smooth' });
};

// ==========================================
// 🛠️ 6. محرك البحث والفلترة الفوري الشامل (وظيفة، شركة، مهارات)
// ==========================================
// ==========================================
// 6. محرك البحث والفلترة الفوري الشامل المحدث
// ==========================================
function filterJobs() {
    // جلب الكلمة المكتوبة وتحويلها لـ Lowercase لضمان دقة البحث الإنجليزي
    const searchKey = searchInput.value.toLowerCase().trim();
    const typeKey = filterType.value;
    const locationKey = filterLocation.value;

    console.log("🔍 كلمة البحث الحالية:", searchKey);

    currentFilteredJobs = allJobs.filter(job => {
        // 1. جلب عنوان الوظيفة
        const jobTitle = (job.title || job.jobTitle || "").toLowerCase();
        
        // 2. جلب اسم الشركة (الاعتماد الكامل على الاسم الديناميكي المجلوب من مجموعة الـ users)
        const companyName = (job.companyName || "").toLowerCase();
        
        // 3. جلب نوع الوظيفة والموقع
        const jobType = job.type || job.jobType || "";
        const jobLocation = job.location || "";
        
        // 4. فحص المهارات المكتوبة
        let matchesSkills = false;
        if (job.skills) {
            const skillsString = Array.isArray(job.skills) ? job.skills.join(" ").toLowerCase() : String(job.skills).toLowerCase();
            matchesSkills = skillsString.includes(searchKey);
        }

        // دمج شروط البحث (البحث يطابق العنوان أو اسم الشركة أو المهارات)
        const matchesSearch = jobTitle.includes(searchKey) || companyName.includes(searchKey) || matchesSkills;
        const matchesType = typeKey === "" || jobType === typeKey;
        const matchesLocation = locationKey === "" || jobLocation === locationKey;

        return matchesSearch && matchesType && matchesLocation;
    });

    // إعادة التوجيه للصفحة الأولى بعد الفلترة
    currentPage = 1;
    
    // إعادة رندرة الكروت بالبيانات المفلترة الجديدة
    renderJobsList(currentFilteredJobs);
}

searchInput.addEventListener("input", filterJobs);
filterType.addEventListener("change", filterJobs);
filterLocation.addEventListener("change", filterJobs);

// ==========================================
// 7. فتح موديول التقديم وإرسال الطلب
// ==========================================
window.openApplyModal = function(jobId, jobTitle, companyId, fullName) {
    window.currentApplyingJob = { jobId, jobTitle, companyId, fullName };
    const applyModal = new bootstrap.Modal(document.getElementById('applyJobModal'));
    applyModal.show();
};

document.getElementById("submitApplicationForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    const linkedinUrl = document.getElementById("applicantLinkedin").value;
    const cvUrl = document.getElementById("applicantCV").value; 
    const phone = document.getElementById("applicantPhone").value;

    if (!window.currentApplyingJob) return;

    try {
        await addDoc(collection(db, "applications"), {
            jobId: window.currentApplyingJob.jobId,
            jobTitle: window.currentApplyingJob.jobTitle,
            companyId: window.currentApplyingJob.companyId,
            fullName: window.currentApplyingJob.fullName,
            
            applicantId: currentUser.uid,
            applicantName: currentUser.fullName || currentUser.name || "مستخدم",
            applicantEmail: auth.currentUser.email,
            applicantPhone: phone,
            
            linkedin: linkedinUrl,
            cvUrl: cvUrl,
            status: "pending", 
            createdAt: new Date()
        });

        alert("تم إرسال طلب التقديم بنجاح! بالتوفيق 👍");
        
        const modalEl = document.getElementById('applyJobModal');
        const modalInstance = bootstrap.Modal.getInstance(modalEl);
        modalInstance.hide();
        document.getElementById("submitApplicationForm").reset();

    } catch (error) {
        console.error("خطأ أثناء إرسال الطلب:", error);
        alert("فشل إرسال الطلب، حاول مرة أخرى.");
    }
});

// ==========================================
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