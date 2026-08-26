const $ = (s) => document.querySelector(s);

function esc(v) {
  return String(v ?? "")
    .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
    .replaceAll('"',"&quot;").replaceAll("'","&#039;");
}

async function getJson(path) {
  const r = await fetch(`${path}?v=${Date.now()}`, { cache: "no-store" });
  if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
  return r.json();
}

function resultsTable(results) {
  return `
    <table>
      <thead><tr>
        <th>Place</th><th>Uma</th><th>Trainer</th>
        <th class="hide-mobile">Gate</th><th>Time</th><th style="text-align:right">Pts</th>
      </tr></thead>
      <tbody>
      ${results.map(x => `
        <tr>
          <td class="place ${x.place === 1 ? "place-1" : ""}">${esc(x.place)}</td>
          <td><strong>${esc(x.uma)}</strong></td>
          <td>${esc(x.display_trainer || x.trainer)}${x.team ? `<div class="race-meta">${esc(x.team)}</div>` : ""}</td>
          <td class="hide-mobile">${esc(x.gate)}</td>
          <td class="time">${esc(x.time_display || "—")}</td>
          <td class="points">${esc(x.points ?? 0)}</td>
        </tr>`).join("")}
      </tbody>
    </table>`;
}

function standingTable(rows, labelKey) {
  if (!rows?.length) return `<div class="empty">No standings yet.</div>`;
  return `
    <table>
      <thead><tr><th>#</th><th>${labelKey === "team" ? "Team" : "Trainer"}</th><th>Wins</th><th>Races</th><th style="text-align:right">Pts</th></tr></thead>
      <tbody>
        ${rows.map((x, i) => `
          <tr>
            <td class="place ${i===0 ? "place-1":""}">${i+1}</td>
            <td><strong>${esc(x[labelKey])}</strong></td>
            <td>${esc(x.wins)}</td>
            <td>${esc(x.races)}</td>
            <td class="points">${esc(x.points)}</td>
          </tr>`).join("")}
      </tbody>
    </table>`;
}

async function boot() {
  try {
    const [idx, standings, cfg] = await Promise.all([
      getJson("data/index.json"),
      getJson("data/standings.json"),
      getJson("config/tournament.json")
    ]);
    document.title = cfg.name || "Uma Race Results";
    $("#title").textContent = cfg.name || "Uma Race Results";
    $("#updated").textContent = idx.updated_at ? `Updated ${new Date(idx.updated_at).toLocaleString()}` : "Not published yet";

    const races = [...(idx.races || [])].sort((a,b) => {
      const ak = [a.round,a.lobby,a.race], bk=[b.round,b.lobby,b.race];
      return bk[0]-ak[0] || bk[1]-ak[1] || bk[2]-ak[2];
    });

    const resultsNode = $("#race-list");
    if (!races.length) {
      resultsNode.innerHTML = `<div class="empty">No races have been published.</div>`;
    } else {
      const cards = [];
      for (const meta of races) {
        const race = await getJson(meta.file);
        cards.push(`
          <article class="race-card">
            <div class="race-head">
              <div>
                <div class="race-title">Round ${esc(race.round)} · Lobby ${esc(race.lobby)} · Race ${esc(race.race)}</div>
                <div class="race-meta">${esc(race.results.length)} finishers · ${esc(race.source_file || "")}</div>
              </div>
              <div class="badge">${esc(race.id)}</div>
            </div>
            ${resultsTable(race.results)}
          </article>`);
      }
      resultsNode.innerHTML = cards.join("");
    }

    $("#trainer-standings").innerHTML = standingTable(standings.trainers, "trainer");
    $("#team-standings").innerHTML = standingTable(standings.teams, "team");
  } catch (e) {
    console.error(e);
    $("#race-list").innerHTML = `<div class="empty">Could not load race data. ${esc(e.message)}</div>`;
  }
}

document.querySelectorAll(".tab").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(x => x.classList.remove("active"));
    document.querySelectorAll(".panel").forEach(x => x.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(btn.dataset.panel).classList.add("active");
  });
});

boot();
