function siteHeader(active){
  const items=[
    ["rules.html","RULES","rules"],
    ["tracks.html","TRACK DRAFT","tracks"],
    ["bracket.html","BRACKET","bracket"],
    ["clubs.html","CLUBS","clubs"],
    ["stats.html","STATS","stats"]
  ];
  document.body.insertAdjacentHTML("afterbegin",`<header class="site-header"><div class="header-inner">
  <a class="brand" href="index.html">The Dominator</a>
  <button class="mobile-toggle">MENU</button>
  <nav class="nav">${items.map(([h,l,k])=>`<a href="${h}" class="${active===k?'active':''}">${l}</a>`).join("")}</nav>
  </div></header>`);
  document.querySelector(".mobile-toggle")?.addEventListener("click",()=>document.querySelector(".nav")?.classList.toggle("open"));
}
function siteFooter(){document.body.insertAdjacentHTML("beforeend",`<footer class="site-footer"><div class="footer-inner">
<span>THE DOMINATOR DRAFT 2026</span><span>Unofficial community competition · not affiliated with Cygames</span>
</div></footer>`)}
async function getJSON(path){const r=await fetch(`${path}?v=${Date.now()}`,{cache:"no-store"});if(!r.ok)throw new Error(`${path}: ${r.status}`);return r.json()}
function esc(v){return String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}
