import { db } from '../../js/firebase-config.js';
import { collection, query, where, onSnapshot, doc, updateDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const auth = getAuth();
// دالة التجديد السريع من الداشباورد المعدلة لتحديث الأسعار التراكمية
window.renewSubFromDashboard = async function(companyId) {
  if (confirm("هل تريد تجديد الاشتراك لهذه الشركة لمدة سنة إضافية؟")) {
    try {
      const companyRef = doc(db, "users", companyId);
      const companySnap = await getDoc(companyRef);

      if (companySnap.exists()) {
        const companyData = companySnap.data();
        
        // جلب سعر الشهر الحالي للشركة
        const monthlyPrice = companyData.monthlyPrice || (companyData.subscriptionPrice / 12 || 0);
        
        const currentExpiry = new Date(companyData.expiryDate);
        const today = new Date();
        
        // تحديد نقطة انطلاق التمديد (لو منتهي يبدأ من اليوم، لو ساري يمتد على القديم)
        let baseDate = currentExpiry > today ? currentExpiry : today;
        const newExpiryDate = new Date(baseDate);
        newExpiryDate.setFullYear(newExpiryDate.getFullYear() + 1); // إضافة سنة كاملة (12 شهر)

        // إضافة قيمة السنة الجديدة إلى التكلفة الإجمالية التراكمية
        const newTotalPrice = (companyData.subscriptionPrice || 0) + (monthlyPrice * 12);
        const newTotalMonths = (companyData.durationMonths || 12) + 12;

        await updateDoc(companyRef, {
          subscriptionStatus: "active",
          expiryDate: newExpiryDate.toISOString(),
          subscriptionPrice: newTotalPrice,
          durationMonths: newTotalMonths
        });

        alert("تم تجديد الاشتراك بنجاح وتحديث إجمالي الأرباح!");
      }
    } catch (error) {
      console.error("Error renewing subscription from dashboard: ", error);
      alert("حدث خطأ أثناء التجديد.");
    }
  }
}

export function renderAdminAnalytics() {
  try {
    const q = query(collection(db, "users"), where("role", "==", "company"));
    
    onSnapshot(q, (querySnapshot) => {
      let activeCount = 0;
      let nearingExpiryCount = 0; // عداد الاشتراكات التي تقترب من الانتهاء
      let expiredCount = 0;
      let totalRevenue = 0;

      const currentDate = new Date();
      const alertContainer = document.getElementById("alertContainer");
      
      if (alertContainer) {
        alertContainer.innerHTML = "";
      }

      querySnapshot.forEach((docSnap) => {
        const company = docSnap.data();
        const expiry = new Date(company.expiryDate);

        // حساب السعر الإجمالي لكل الاشتراكات (سارية + منتهية) بدون شروط
        totalRevenue += company.subscriptionPrice || 0;

        const timeDiff = expiry - currentDate;
        const daysLeft = Math.ceil(timeDiff / (1000 * 3600 * 24));

        // تصنيف حالة الاشتراك بناءً على الأيام المتبقية للرسم البياني
        if (daysLeft < 0) {
          expiredCount++;
        } else if (daysLeft <= 30) {
          nearingExpiryCount++; // ساري ولكن باقي 30 يوم أو أقل
        } else {
          activeCount++; // ساري وأكثر من 30 يوم
        }

        // إظهار التنبيه إذا كان باقي 30 يوم أو أقل أو منتهي
        if (alertContainer && daysLeft <= 30) {
          const isExpired = daysLeft < 0;
          const borderClass = isExpired ? "border-danger" : "border-warning";
          const icon = isExpired ? "🚨" : "⚠️";
          const btnClass = isExpired ? "btn-danger" : "btn-warning";
          
          const alertText = isExpired 
            ? `انتهى اشتراك شركة <strong>${company.fullName}</strong>.` 
            : `اشتراك شركة <strong>${company.fullName}</strong> سينتهي خلال ${daysLeft} يوم.`;

          // تصميم تنبيه عصري (خلفية بيضاء، حد أيسر ملون، تباعد منظم)
          alertContainer.innerHTML += `
            <div class="alert bg-white border-0 border-start border-4 ${borderClass} shadow-sm rounded-2 d-flex justify-content-between align-items-center py-3 px-4 mb-3" role="alert">
              <div class="d-flex align-items-center fs-6 text-dark">
                <span class="me-3 fs-4" style="line-height: 1;">${icon}</span>
                <span>${alertText}</span>
              </div>
              <div class="d-flex align-items-center gap-3 flex-shrink-0">
                <button class="btn btn-sm ${btnClass} text-white fw-bold px-3 py-1" onclick="renewSubFromDashboard('${docSnap.id}')">تجديد الآن</button>
                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
              </div>
            </div>
          `;
        }
      });

      // تحديث الأرقام والإحصائيات في واجهة المستخدم
      document.getElementById("totalCompanies").innerText = querySnapshot.size;
      document.getElementById("activeSubs").innerText = activeCount + nearingExpiryCount; // عرض إجمالي المشتركين الفعليين حالياً
      document.getElementById("expiredSubs").innerText = expiredCount;
      document.getElementById("totalRevenue").innerText = `${totalRevenue} ج.م`;

      // رسم الـ Pie Chart بالتحديث الجديد (3 حالات)
      const ctx = document.getElementById('subscriptionPieChart').getContext('2d');
      if (window.pieChartInstance) {
        window.pieChartInstance.destroy();
      }

      window.pieChartInstance = new Chart(ctx, {
        type: 'pie',
        data: {
          labels: ['اشتراكات سارية', 'قربت على الانتهاء', 'اشتراكات منتهية'],
          datasets: [{
            data: [activeCount, nearingExpiryCount, expiredCount],
            backgroundColor: ['#198754', '#ffc107', '#dc3545'], // أخضر، أصفر تحذيري، أحمر
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: { position: 'top' }
          }
        }
      });
    });

  } catch (error) {
    console.error("Error rendering analytics: ", error);
    alert("حدث خطأ أثناء جلب الإحصائيات.");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  renderAdminAnalytics();
  displayAdminProfile();
  
  const logoutBtn = document.getElementById("logoutBtn");
  if(logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      alert("تم تسجيل الخروج");
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