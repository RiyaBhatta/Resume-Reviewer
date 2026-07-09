let selectedFile = null;

function onDragOver(e) {
  e.preventDefault();
  document.getElementById("dropZone").classList.add("drag-over");
}

function onDragLeave() {
  document.getElementById("dropZone").classList.remove("drag-over");
}

function onDrop(e) {
  e.preventDefault();
  onDragLeave();
  const file = e.dataTransfer.files[0];
  if (file) setFile(file);
}

function onFileSelect(e) {
  const file = e.target.files[0];
  if (file) setFile(file);
}

function setFile(file) {
  const allowed = ["pdf", "docx"];
  const ext = file.name.split(".").pop().toLowerCase();
  if (!allowed.includes(ext)) {
    showError("Only PDF or DOCX files are supported.");
    return;
  }
  selectedFile = file;
  document.getElementById("dropContent").classList.add("hidden");
  document.getElementById("fileName").textContent = file.name;
  document.getElementById("fileSelected").classList.remove("hidden");
  document.getElementById("resume").value = "";
}

function removeFile(e) {
  e.stopPropagation();
  selectedFile = null;
  document.getElementById("fileInput").value = "";
  document.getElementById("fileSelected").classList.add("hidden");
  document.getElementById("dropContent").classList.remove("hidden");
}

async function reviewResume() {
  const resumeText = document.getElementById("resume").value.trim();
  const jobDescription = document.getElementById("jobDesc").value.trim();
  const btn = document.getElementById("reviewBtn");

  if (!selectedFile && !resumeText) {
    showError("Please upload a resume file or paste your resume text.");
    return;
  }

  hideAll();
  btn.disabled = true;
  document.getElementById("loading").classList.remove("hidden");

  try {
    let res;
    if (selectedFile) {
      const formData = new FormData();
      formData.append("resume", selectedFile);
      if (jobDescription) formData.append("jobDescription", jobDescription);
      res = await fetch("/review", { method: "POST", body: formData });
    } else {
      res = await fetch("/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeText, jobDescription }),
      });
    }

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Server error");
    renderResults(data);
  } catch (err) {
    showError(err.message);
  } finally {
    btn.disabled = false;
    document.getElementById("loading").classList.add("hidden");
  }
}

function renderResults(data) {
  const score = Math.min(100, Math.max(0, data.score || 0));
  document.getElementById("scoreValue").textContent = score;
  document.querySelector(".score-circle").style.setProperty("--pct", `${score}%`);
  document.getElementById("summary").textContent = data.summary || "";

  document.getElementById("strengthsList").innerHTML =
    (data.strengths || []).map(s => `<li>${s}</li>`).join("");

  document.getElementById("improvementsList").innerHTML =
    (data.improvements || []).map(i => `<li>${i}</li>`).join("");

  document.getElementById("keywordsFound").innerHTML =
    (data.keywords?.found || []).map(k => `<span>${k}</span>`).join("");

  document.getElementById("keywordsMissing").innerHTML =
    (data.keywords?.missing || []).map(k => `<span>${k}</span>`).join("");

  const sections = data.sections || {};
  document.getElementById("sectionsFeedback").innerHTML = Object.entries(sections)
    .filter(([, v]) => v)
    .map(([k, v]) => `<div class="section-item"><strong>${k}</strong><p>${v}</p></div>`)
    .join("");

  document.getElementById("results").classList.remove("hidden");
}

function showError(msg) {
  document.getElementById("errorMsg").textContent = msg;
  document.getElementById("error").classList.remove("hidden");
}

function hideAll() {
  ["results", "error"].forEach(id =>
    document.getElementById(id).classList.add("hidden")
  );
}
