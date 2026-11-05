import "./showcase-live.css";
const categories=["AI Movies & Dramas","Websites & Apps","AI Graphics & Images","Videos & Animations"];
let projects=[],ready=false,painting=false;
const esc=s=>String(s||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const categoryForFilter=f=>f==="All"?null:f;
function paint(){
 const grid=document.querySelector(".project-grid");if(!grid||painting)return;painting=true;
 const active=document.querySelector(".filters button.active")?.textContent?.trim()||"All";
 const list=projects.filter(p=>active==="All"||p.category===categoryForFilter(active));
 const html=list.length?list.map((p,i)=>{const contact=p.contact_public&&p.creator_phone?'<a class="creator-contact" href="https://wa.me/'+esc(p.creator_phone.replace(/\D/g,""))+'" target="_blank" rel="noopener noreferrer">CONTACT PRODUCER ↗</a>':"";const action=p.content_type==="website"?"VISIT WEBSITE":p.content_type==="image"?"VIEW IMAGE":"WATCH NOW";return '<article class="project live-project"><a class="live-project-image" href="'+esc(p.destination_url)+'" target="_blank" rel="noopener noreferrer"><img src="'+esc(p.thumbnail_url)+'" alt="'+esc(p.title)+'" loading="lazy"/><span>'+action+' ↗</span></a><div class="project-info"><div><small>'+esc(p.category)+' · '+esc(p.content_type.toUpperCase())+'</small><h3>'+esc(p.title)+'</h3><p>'+esc(p.description)+'</p>'+(p.creator_name?'<small class="creator-byline">CREATED BY '+esc(p.creator_name)+(p.creator_country?' · '+esc(p.creator_country):"")+'</small>':"")+contact+'</div><a href="'+esc(p.destination_url)+'" target="_blank" rel="noopener noreferrer" aria-label="'+action+'">↗</a></div></article>'}).join(""):'<p class="showcase-note live-empty">New student projects will appear here as soon as they are published.</p>';
 const note=document.querySelector(".showcase-note");if(note&&note.parentElement===grid.parentElement)note.remove();
 if(grid.innerHTML!==html)grid.innerHTML=html;
 painting=false;
}
async function load(){try{const r=await fetch("/api/showcase");const d=await r.json();if(r.ok){projects=d.projects||[];ready=true;paint()}}catch{}}
const observer=new MutationObserver(()=>{if(ready)paint()});
observer.observe(document.body,{childList:true,subtree:true});
document.addEventListener("click",e=>{if(e.target.closest(".filters button"))setTimeout(paint,0)});
load();
