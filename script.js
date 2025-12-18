const USERNAME = "IloveChanel";

// Put your BEST repos here to show them first (exact repo names)
const FEATURED_REPOS = [
  // "michelle-vance-portfolio",
  // "portfolio",
  // "your-best-project",
];

const projectsGrid = document.getElementById("projectsGrid");
const statusEl = document.getElementById("status");
const searchEl = document.getElementById("search");
const filterEl = document.getElementById("filter");
const refreshBtn = document.getElementById("refresh");

document.getElementById("year").textContent = new Date().getFullYear();

function setStatus(msg) {
  statusEl.textContent = msg || "";
}

function fmtDate(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

function escapeHtml(str = "") {
  return str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function projectCard(repo) {
  const name = escapeHtml(repo.name);
  const desc = escapeHtml(repo.description || "No description yet — add one in GitHub repo settings.");
  const lang = repo.language ? `<span class="badge">${escapeHtml(repo.language)}</span>` : "";
  const stars = `<span class="badge">★ ${repo.stargazers_count}</span>`;
  const updated = `<span class="badge">Updated ${fmtDate(repo.pushed_at)}</span>`;
  const topics = (repo.topics || []).slice(0, 4).map(t => `<span class="badge">#${escapeHtml(t)}</span>`).join("");

  const repoUrl = repo.html_url;
  const liveUrl = repo.homepage && repo.homepage.startsWith("http") ? repo.homepage : "";

  const liveBtn = liveUrl
    ? `<a class="btn btn-small btn-ghost" href="${liveUrl}" target="_blank" rel="noreferrer">Live Demo</a>`
    : "";

  return `
    <article class="project"
      data-name="${name.toLowerCase()}"
      data-lang="${(repo.language || "").toLowerCase()}"
      data-topics="${(repo.topics || []).join(" ").toLowerCase()}">
      <div>
        <h3>${name}</h3>
        <p>${desc}</p>
      </div>
      <div class="meta">
        ${lang}
        ${stars}
        ${updated}
        ${topics}
      </div>
      <div class="actions">
        <a class="btn btn-small" href="${repoUrl}" target="_blank" rel="noreferrer">Repo</a>
        ${liveBtn}
      </div>
    </article>
  `;
}

function rankRepos(repos) {
  const featuredSet = new Set(FEATURED_REPOS.map(r => r.toLowerCase()));

  return repos
    .filter(r => !r.fork) // hide forks by default
    .map(r => ({
      ...r,
      _featured: featuredSet.has(r.name.toLowerCase()),
    }))
    .sort((a, b) => {
      if (a._featured && !b._featured) return -1;
      if (!a._featured && b._featured) return 1;
      return new Date(b.pushed_at) - new Date(a.pushed_at);
    });
}

function applyUIFilters() {
  const q = (searchEl.value || "").trim().toLowerCase();
  const mode = filterEl.value;

  const cards = Array.from(projectsGrid.querySelectorAll(".project"));
  let visible = 0;

  cards.forEach(card => {
    const name = card.getAttribute("data-name") || "";
    const lang = card.getAttribute("data-lang") || "";
    const topics = card.getAttribute("data-topics") || "";
    const matchesSearch = !q || name.includes(q) || lang.includes(q) || topics.includes(q);

    let matchesMode = true;
    if (mode === "featured") {
      matchesMode = card.hasAttribute("data-featured");
    }

    card.style.display = (matchesSearch && matchesMode) ? "" : "none";
    if (card.style.display !== "none") visible++;
  });

  setStatus(`${visible} project(s) shown`);
}

function setSortMode(repos, mode) {
  const copy = [...repos];
  if (mode === "recent") {
    copy.sort((a, b) => new Date(b.pushed_at) - new Date(a.pushed_at));
  } else if (mode === "stars") {
    copy.sort((a, b) => b.stargazers_count - a.stargazers_count);
  }
  return copy;
}

function renderRepos(repos) {
  projectsGrid.innerHTML = "";
  if (!repos.length) {
    projectsGrid.innerHTML = `<div class="card">No repos found. Make sure your repos are public.</div>`;
    return;
  }

  const featuredSet = new Set(FEATURED_REPOS.map(r => r.toLowerCase()));

  const html = repos.map(r => {
    const card = projectCard(r);
    if (featuredSet.has(r.name.toLowerCase())) {
      return card.replace('<article class="project"', '<article class="project" data-featured="true"');
    }
    return card;
  }).join("");

  projectsGrid.innerHTML = html;
  applyUIFilters();
}

async function fetchRepos({ force = false } = {}) {
  const cacheKey = `gh_repos_${USERNAME}`;
  const cacheTtlMs = 10 * 60 * 1000; // 10 minutes

  if (!force) {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Date.now() - parsed.savedAt < cacheTtlMs) {
          setStatus("Loaded projects from cache.");
          return parsed.data;
        }
      } catch {}
    }
  }

  setStatus("Loading projects from GitHub…");

  const res = await fetch(`https://api.github.com/users/${USERNAME}/repos?per_page=100&sort=updated`, {
    headers: {
      "Accept": "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28"
    }
  });

  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);

  const data = await res.json();
  localStorage.setItem(cacheKey, JSON.stringify({ savedAt: Date.now(), data }));
  return data;
}

let allRepos = [];

async function init() {
  try {
    const repos = await fetchRepos();
    allRepos = rankRepos(repos);

    const mode = filterEl.value;
    const sorted = (mode === "all" || mode === "featured")
      ? allRepos
      : setSortMode(allRepos, mode);

    renderRepos(sorted);
    setStatus(`Loaded ${allRepos.length} repo(s).`);
  } catch (err) {
    setStatus("Couldn’t load projects from GitHub right now. (API rate limit or connection issue)");
    projectsGrid.innerHTML = `
      <div class="card">
        <h3>Projects couldn’t load</h3>
        <p class="muted">No worries — your portfolio still works. Try “Refresh” or check again later.</p>
        <p class="muted small">${escapeHtml(String(err.message || err))}</p>
        <div class="divider"></div>
        <a class="btn btn-small" href="https://github.com/${USERNAME}?tab=repositories" target="_blank" rel="noreferrer">View Repos on GitHub</a>
      </div>
    `;
  }
}

searchEl.addEventListener("input", applyUIFilters);

filterEl.addEventListener("change", () => {
  if (!allRepos.length) return;

  const mode = filterEl.value;
  let reposToRender = allRepos;

  if (mode === "recent" || mode === "stars") {
    reposToRender = setSortMode(allRepos, mode);
  }

  renderRepos(reposToRender);
  applyUIFilters();
});

refreshBtn.addEventListener("click", async () => {
  try {
    const repos = await fetchRepos({ force: true });
    allRepos = rankRepos(repos);
    renderRepos(allRepos);
    setStatus("Refreshed from GitHub.");
  } catch {
    setStatus("Refresh failed. Try again in a minute.");
  }
});

init();

