let allJobs = []; // مصفوفة لتخزين كل الوظائف القادمة من السيرفر

// استدعاء الوظائف عند فتح الصفحة
export async function fetchAllJobsForUsers() {
  const querySnapshot = await getDocs(collection(db, "jobs"));
  allJobs = [];
  querySnapshot.forEach(doc => {
    allJobs.push({ id: doc.id, ...doc.data() });
  });
  renderJobs(allJobs); // عرض الكل في البداية
}

// دالة الفلترة والـ Live Search (تُستدعى مع كل حرك في الـ Input)
document.getElementById("searchInput").addEventListener("input", filterJobs);
document.getElementById("companyFilterSelect").addEventListener("change", filterJobs);

function filterJobs() {
  const searchText = document.getElementById("searchInput").value.toLowerCase();
  const selectedCompany = document.getElementById("companyFilterSelect").value;

  const filtered = allJobs.filter(job => {
    const matchesSearch = job.title.toLowerCase().includes(searchText) || job.skills.toLowerCase().includes(searchText);
    const matchesCompany = selectedCompany === "" || job.companyName === selectedCompany;
    
    return matchesSearch && matchesCompany;
  });

  renderJobs(filtered); // إعادة عرض العناصر المفلترة فقط
}