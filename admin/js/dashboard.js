import { db } from '../../js/firebase-config.js';
import { collection, query, where, onSnapshot, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// دالة التجديد السريع من الداشباورد
window.renewSubFromDashboard = async function(companyId) {
  if (confirm("هل تريد تجديد الاشتراك لهذه الشركة لمدة سنة إضافية؟")) {
    try {
      const companyRef = doc(db, "users", companyId);
      const newExpiryDate = new Date();
      newExpiryDate.setFullYear(newExpiryDate.getFullYear() + 1); // تمديد سنة كاملة

      await updateDoc(companyRef, {
        subscriptionStatus: "active",
        expiryDate: newExpiryDate.toISOString()
      });

      alert("تم تجديد الاشتراك بنجاح!");
    } catch (error) {
      console.error("Error renewing subscription: ", error);
      alert("حدث خطأ أثناء التجديد.");
    }
  }
}

export function renderAdminAnalytics() {
  try {
    const q = query(collection(db, "users"), where("role", "==", "company"));
    
    onSnapshot(q, (querySnapshot) => {
      let activeCount = 0;
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

        if (currentDate <= expiry) {
          activeCount++;
          totalRevenue += company.subscriptionPrice || 0;
        } else {
          expiredCount++;
        }

        const timeDiff = expiry - currentDate;
        const daysLeft = Math.ceil(timeDiff / (1000 * 3600 * 24));

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
      document.getElementById("activeSubs").innerText = activeCount;
      document.getElementById("expiredSubs").innerText = expiredCount;
      document.getElementById("totalRevenue").innerText = `${totalRevenue} ج.م`;

      // رسم الـ Pie Chart
      const ctx = document.getElementById('subscriptionPieChart').getContext('2d');
      if (window.pieChartInstance) {
        window.pieChartInstance.destroy();
      }

      window.pieChartInstance = new Chart(ctx, {
        type: 'pie',
        data: {
          labels: ['اشتراكات سارية', 'اشتراكات منتهية'],
          datasets: [{
            data: [activeCount, expiredCount],
            backgroundColor: ['#198754', '#dc3545'],
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
  
  const logoutBtn = document.getElementById("logoutBtn");
  if(logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      alert("تم تسجيل الخروج");
      window.location.href = "../auth.html";
    });
  }
});