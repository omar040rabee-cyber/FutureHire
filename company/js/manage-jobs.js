import { db, auth } from '../../js/firebase-config.js';
import { 
  collection, query, where, orderBy, limit, startAfter, getDocs 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

let lastVisibleDoc = null; // بيحفظ آخر مستند وصلنا له عشان الـ Next
let firstVisibleDoc = null; // بيحفظ أول مستند عشان الـ Previous (لو هتعملها)
const pageSize = 5; // عدد الوظائف في كل صفحة

export async function loadCompanyJobs(isNext = true) {
  const companyId = auth.currentUser.uid;
  let jobsQuery;

  if (!lastVisibleDoc) {
    // الصفحة الأولى
    jobsQuery = query(
      collection(db, "jobs"),
      where("companyId", "==", companyId),
      orderBy("createdAt", "desc"),
      limit(pageSize)
    );
  } else if (isNext) {
    // الصفحة التالية
    jobsQuery = query(
      collection(db, "jobs"),
      where("companyId", "==", companyId),
      orderBy("createdAt", "desc"),
      startAfter(lastVisibleDoc),
      limit(pageSize)
    );
  }

  const documentSnapshots = await getDocs(jobsQuery);
  
  if (documentSnapshots.empty) {
    alert("لا توجد بيانات أخرى لعرضها.");
    return;
  }

  // تحديث المؤشرات
  lastVisibleDoc = documentSnapshots.docs[documentSnapshots.docs.length - 1];
  
  // كود رندر البيانات في الجدول (Bootstrap Table)
  const tbody = document.getElementById("jobsTableBody");
  tbody.innerHTML = ""; // تصفية الجدول الحالي

  documentSnapshots.forEach((doc) => {
    const job = doc.data();
    tbody.innerHTML += `
      <tr>
        <td>${job.title}</td>
        <td>${job.category}</td>
        <td>${job.applicantsCount || 0}</td>
        <td>
          <button class="btn btn-sm btn-warning" onclick="editJob('${doc.id}')">تعديل</button>
          <button class="btn btn-sm btn-danger" onclick="deleteJob('${doc.id}')">حذف</button>
        </td>
      </tr>
    `;
  });
}