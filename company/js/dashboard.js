import { db } from '../../js/firebase-config.js'; 
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, doc, query, where, onSnapshot, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
const auth = getAuth();
let currentCompanyId = null;

// متغيرات لتخزين كائنات الرسوم البيانية حتى نتمكن من تحديثها فوريًا دون تداخل
let jobsBarChartInstance = null;
let statusPieChartInstance = null;

// مصفوفات محلية للاحتفاظ بالبيانات والربط بينها في الذاكرة
let companyJobs = [];
let companyApplications = [];

// ==========================================
// 1. التحقق من هوية الشركة وتحميل بيانات الملف الشخصي
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
                
                // تحديث الهيدر والـ Navbar
                document.getElementById("companyName").innerText = name;
                document.getElementById("welcome-company").innerText = `مرحباً بك، ${name} 👋`;
                document.getElementById("companyAvatar").innerText = name.charAt(0).toUpperCase();
                
                // بدء الاستماع الفوري للبيانات
                startDashboardRealtimeStream();
            }
        } catch (error) {
            console.error("Error loading company profile:", error);
        }
    } else {
        // حماية اللوحة: التوجيه لصفحة الدخول إذا لم يسجل
        window.location.href = "../auth.html";
    }
});

// ==========================================
// 2. تشغيل بث البيانات الفوري (Jobs & Applications)
// ==========================================
function startDashboardRealtimeStream() {
    const jobsQuery = query(collection(db, "jobs"), where("companyId", "==", currentCompanyId));
    const appsQuery = query(collection(db, "applications"), where("companyId", "==", currentCompanyId));

    // أ- مستمع الوظائف الفوري
    onSnapshot(jobsQuery, (jobsSnapshot) => {
        companyJobs = [];
        let activeJobsCount = 0;

        jobsSnapshot.forEach((doc) => {
            const jobData = doc.data();
            jobData.id = doc.id;
            companyJobs.push(jobData);

            if (jobData.status === "active" || !jobData.status) {
                activeJobsCount++;
            }
        });

        // تحديث كارت الوظائف النشطة في الواجهة
        document.getElementById("count-active-jobs").innerText = activeJobsCount;

        // تحديث الرسوم البيانية بعد تحديث قائمة الوظائف
        updateCharts();
    });

    // ب- مستمع طلبات التقديم الفوري
    onSnapshot(appsQuery, (appsSnapshot) => {
        companyApplications = [];
        let acceptedCount = 0;

        appsSnapshot.forEach((doc) => {
            const appData = doc.data();
            appData.id = doc.id;
            companyApplications.push(appData);

            // حساب المتقدمين المقبولين للمقابلات
            if (appData.status === "accepted" || appData.status === "مقبول") {
                acceptedCount++;
            }
        });

        // تحديث الكروت في الواجهة
        document.getElementById("count-total-apps").innerText = companyApplications.length;
        document.getElementById("count-accepted-apps").innerText = acceptedCount;

        // تحديث الرسوم البيانية بعد تحديث طلبات التقديم
        updateCharts();
    });
}

// ==========================================
// 3. دالة معالجة البيانات وتحديث الرسوم البيانية (Charts)
// ==========================================
function updateCharts() {
    if (companyJobs.length === 0) return;

    // --- [أ] تجهيز بيانات الـ Bar Chart (عدد المتقدمين لكل وظيفة) ---
    const jobTitles = [];
    const applicantsPerJob = [];

    companyJobs.forEach(job => {
        jobTitles.push(job.title);
        // فلترة طلبات التقديم التي تخص هذه الوظيفة بالتحديد
        const count = companyApplications.filter(app => app.jobId === job.id).length;
        applicantsPerJob.push(count);
    });

    renderBarChart(jobTitles, applicantsPerJob);

    // --- [ب] تجهيز بيانات الـ Pie Chart (تحليل الحالات) ---
    let pending = 0, accepted = 0, rejected = 0;

    companyApplications.forEach(app => {
        const status = app.status ? app.status.toLowerCase() : "pending";
        if (status === "accepted" || status === "مقبول") accepted++;
        else if (status === "rejected" || status === "مرفوض") rejected++;
        else pending++; // قيد المراجعة
    });

    renderPieChart(pending, accepted, rejected);
}

// ==========================================
// 4. بناء وتحديث الرسم البياني الشريطي (Bar Chart)
// ==========================================
function renderBarChart(labels, dataValues) {
    const ctx = document.getElementById('jobsBarChart').getContext('2d');
    
    // تدمير الرسم القديم إن وجد لمنع التداخل والـ Glitches عند التحديث
    if (jobsBarChartInstance) {
        jobsBarChartInstance.destroy();
    }

    jobsBarChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'عدد المتقدمين',
                data: dataValues,
                backgroundColor: 'rgba(13, 110, 253, 0.75)', // لون FutureHire الأساسي
                borderColor: 'rgb(13, 110, 253)',
                borderWidth: 1,
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { stepSize: 1 }
                }
            }
        }
    });
}

// ==========================================
// 5. بناء وتحديث الرسم البياني الدائري (Pie Chart)
// ==========================================
function renderPieChart(pending, accepted, rejected) {
    const ctx = document.getElementById('statusPieChart').getContext('2d');

    if (statusPieChartInstance) {
        statusPieChartInstance.destroy();
    }

    statusPieChartInstance = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: ['قيد المراجعة', 'مقبول للمقابلة', 'مرفوض'],
            datasets: [{
                data: [pending, accepted, rejected],
                backgroundColor: [
                    '#ffc107', // أصفر للـ Pending
                    '#198754', // أخضر للـ Accepted
                    '#dc3545'  // أحمر للـ Rejected
                ],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { font: { family: 'inherit' }, boxWidth: 15 }
                }
            }
        }
    });
}

// ==========================================
// 6. زر تسجيل الخروج
// ==========================================
document.getElementById("logoutBtn").addEventListener("click", () => {
    alert("تم تسجيل الخروج بنجاح");
    window.location.href = "../auth.html";
});