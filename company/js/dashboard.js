import { auth, db } from "../../js/firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

let currentCompanyId = null;

// التأكد من حالة تسجيل الدخول وصلاحية الشركة
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentCompanyId = user.uid;
        
        // جلب اسم الشركة وعرضه في الترحيب
        const companyDocs = await getDocs(query(collection(db, "users"), where("uid", "==", user.uid)));
        companyDocs.forEach(doc => {
            document.getElementById("welcome-company").innerText = `مرحباً، ${doc.data().name}`;
        });

        // تحميل الإحصائيات والرسوم البيانية
        loadDashboardData();
    } else {
        // لو مش مسجل دخول يرجعه لصفحة الـ Login الأساسية
        window.location.href = "../auth.html";
    }
});

// دالة جلب البيانات وتحديث الـ UI والـ Charts
async function loadDashboardData() {
    try {
        // 1. جلب الوظائف الخاصة بهذه الشركة فقط
        const jobsQuery = query(collection(db, "jobs"), where("companyId", "==", currentCompanyId));
        const jobsSnapshot = await getDocs(jobsQuery);
        
        let activeJobsCount = jobsSnapshot.size;
        document.getElementById("count-active-jobs").innerText = activeJobsCount;

        let jobTitles = [];
        let jobApplicationsCount = [];

        jobsSnapshot.forEach(doc => {
            const data = doc.data();
            jobTitles.push(data.title);
            jobApplicationsCount.push(data.applicantsCount || 0); // لو الحقل مش موجود يحط 0
        });

        // 2. جلب طلبات التقديم الخاصة بوظائف الشركة
        const appsQuery = query(collection(db, "applications"), where("companyId", "==", currentCompanyId));
        const appsSnapshot = await getDocs(appsQuery);
        
        let totalApps = appsSnapshot.size;
        document.getElementById("count-total-apps").innerText = totalApps;

        let pendingCount = 0;
        let acceptedCount = 0;
        let rejectedCount = 0;

        appsSnapshot.forEach(doc => {
            const status = doc.data().status;
            if (status === "pending") pendingCount++;
            else if (status === "accepted") acceptedCount++;
            else if (status === "rejected") rejectedCount++;
        });

        document.getElementById("count-accepted-apps").innerText = acceptedCount;

        // 3. بناء الرسوم البيانية بالبيانات الفعلية
        renderCharts(jobTitles, jobApplicationsCount, pendingCount, acceptedCount, rejectedCount);

    } catch (error) {
        console.error("Error loading dashboard data:", error);
    }
}

// دالة رسم الـ Charts باستخدام Chart.js
function renderCharts(jobLabels, jobData, pending, accepted, rejected) {
    // أ) Bar Chart للوظائف ونسب المتقدمين
    const ctxBar = document.getElementById('jobsBarChart').getContext('2d');
    new Chart(ctxBar, {
        type: 'bar',
        data: {
            labels: jobLabels.length > 0 ? jobLabels : ["لا يوجد وظائف حالياً"],
            datasets: [{
                label: 'عدد المتقدمين',
                data: jobData.length > 0 ? jobData : [0],
                backgroundColor: '#0d6efd',
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { beginAtZero: true } }
        }
    });

    // ب) Pie Chart لحالات طلبات التوظيف (مقبول / مرفوض / معلق)
    const ctxPie = document.getElementById('appsPieChart').getContext('2d');
    new Chart(ctxPie, {
        type: 'pie',
        data: {
            labels: ['قيد المراجعة', 'مقبول للمقابلة', 'مرفوض'],
            datasets: [{
                data: [pending, accepted, rejected],
                backgroundColor: ['#ffc107', '#198754', '#dc3545']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });
}

// زرار تسجيل الخروج
document.getElementById("logout-btn").addEventListener("click", () => {
    signOut(auth).then(() => {
        window.location.href = "../auth.html";
    });
});