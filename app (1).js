/* PR0CESS // QUEUE — links-only edition. Edit config.js, not this file. */
(function(){
"use strict";

var CFG = window.PQ_CONFIG || {};
var BRAND=CFG.BRAND||"PR0CESS", BRAND_TAIL=CFG.BRAND_TAIL||"QUEUE", BRAND_SUB=CFG.BRAND_SUB||"";
var GENRES=CFG.GENRES||["Other"];
var CONFIGURED = CFG.SUPABASE_URL && CFG.SUPABASE_URL.indexOf("PASTE")!==0 && window.supabase;
var sb = CONFIGURED ? window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY) : null;

var app=document.getElementById("app");
function esc(s){return (s||"").replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function route(){return location.hash.replace("#","").split("?")[0]||"submit";}
function wordmark(){ return BRAND.replace("0",'<span class="z">0</span>')+' <span class="z">//</span> '+BRAND_TAIL; }

/* ---------------- state ---------------- */
var State={open:true,items:[]};
var listeners=[]; var pollT=null;
function onState(fn){listeners.push(fn);fn();}
function emit(){listeners.forEach(function(fn){fn();});}
function current(){return State.items.filter(function(i){return i.status==="reviewing";})[0]||null;}
function queued(){return State.items.filter(function(i){return i.status==="queued";}).sort(function(a,b){return a.sort_key-b.sort_key;});}
function reviewed(){return State.items.filter(function(i){return i.status==="done"||i.status==="skipped";});}

function refresh(){
  if(!sb) return Promise.resolve();
  return Promise.all([
    sb.from("queue").select("*"),
    sb.from("session").select("open").eq("id",1).single()
  ]).then(function(res){
    if(!res[0].error) State.items=res[0].data||[];
    if(!res[1].error && res[1].data) State.open=!!res[1].data.open;
    emit();
  });
}
function startLive(){
  if(!sb) return;
  refresh();
  try{
    sb.channel("pq")
      .on("postgres_changes",{event:"*",schema:"public",table:"queue"},refresh)
      .on("postgres_changes",{event:"*",schema:"public",table:"session"},refresh)
      .subscribe();
  }catch(e){}
  clearInterval(pollT); pollT=setInterval(refresh, 7000); // safety net if realtime hiccups
}

/* ---------------- admin (PIN) ---------------- */
var PIN = localStorage.getItem("pq_pin")||"";
function verifyPin(pin){ return sb.rpc("pq_verify_pin",{p_pin:pin}).then(function(r){return !r.error && r.data===true;}); }
function admin(cmd,id){
  return sb.rpc("pq_admin",{p_pin:PIN,p_cmd:cmd,p_id:id||null}).then(function(r){
    if(r.error){
      if(/bad pin/i.test(r.error.message)){ PIN=""; localStorage.removeItem("pq_pin"); render(); }
      else alert("Action failed: "+r.error.message);
    }
    return refresh();
  });
}

/* ---------------- shared UI ---------------- */
function nav(active){
  function link(h,l){return '<a href="#'+h+'" class="'+(active===h?'on':'')+'">'+l+'</a>';}
  return '<div class="modenav">'+link('submit','Submit')+link('queue','Dashboard')+link('overlay','OBS Overlay')+'</div>';
}
function pill(){
  if(!CONFIGURED) return '<span class="statuspill closed">not connected</span>';
  var cls=State.open?"open":"closed";
  return '<span class="statuspill '+cls+'">'+(State.open?"Open":"Closed")+' · '+queued().length+' waiting</span>';
}
function stripView(it,n,kind,acts){
  var cls=kind==="live"?"strip live":"strip";
  var style=it.status==="skipped"?' style="opacity:.55"':(kind==="done"?' style="opacity:.7"':'');
  return '<div class="'+cls+'"'+style+'><div class="num">'+n+'</div><div class="body">'+
    '<div class="who">'+esc(it.handle)+(it.status==="skipped"?' <span class="skiptag">SKIPPED</span>':'')+'</div>'+
    '<div class="title">'+esc(it.title)+'</div>'+
    '<div class="meta">'+(it.genre?'<span class="tag">'+esc(it.genre)+'</span>':'')+
      '<a href="'+esc(it.link)+'" target="_blank" rel="noopener">open link ↗</a></div>'+
    (it.note?'<div class="note">'+esc(it.note)+'</div>':'')+
    (kind==="live"?'<div class="meter"><i></i></div>':'')+
  '</div>'+(acts?'<div class="acts">'+acts+'</div>':'')+'</div>';
}
function notConfigured(){
  app.innerHTML='<div class="wrap"><div class="gate"><div class="g-brand">'+wordmark()+'</div>'+
  '<p>Not connected yet. Open <b>config.js</b> and paste your Supabase URL and anon key (Settings → API), then reload.</p></div></div>';
}

/* ---------------- SUBMIT ---------------- */
function renderSubmit(){
  if(!CONFIGURED){ notConfigured(); return; }
  app.innerHTML='<div class="wrap">'+
    '<div class="mast"><div class="brand">'+wordmark()+'<small>'+esc(BRAND_SUB)+'</small></div><span id="pill"></span></div>'+
    nav('submit')+'<div id="formzone"></div>'+
    '<div class="foot"><span>v1.0.0</span><span>'+wordmark()+'</span></div></div>';
  var built=false;
  onState(function(){
    var p=document.getElementById("pill"); if(p) p.innerHTML=pill();
    var fz=document.getElementById("formzone"); if(!fz) return;
    if(!State.open){ built=false;
      fz.innerHTML='<div class="empty"><b>The queue is closed right now.</b>G-REX isn\'t taking submissions at the moment. Catch the next feedback stream on PR0CESS_LIVE.</div>';
      return; }
    if(built) return; built=true;
    buildForm(fz);
  });
}
function buildForm(fz){
  var genre="";
  fz.innerHTML=
    '<div class="field"><label>Producer / handle <span class="req">*</span></label><input id="f-handle" type="text" maxlength="40" placeholder="@yourhandle" autocomplete="off"></div>'+
    '<div class="field"><label>Track title <span class="req">*</span></label><input id="f-title" type="text" maxlength="80" placeholder="what\'s it called"></div>'+
    '<div class="field"><label>Link <span class="req">*</span></label><input id="f-link" type="url" placeholder="SoundCloud or Dropbox link that plays"></div>'+
    '<div class="field"><label>Genre</label><div class="chips" id="f-genre">'+GENRES.map(function(g){return '<button type="button" class="chip" data-g="'+esc(g)+'">'+esc(g)+'</button>';}).join("")+'</div></div>'+
    '<div class="field"><label>What do you want feedback on?</label><textarea id="f-note" maxlength="240" placeholder="optional — point him at the part you\'re unsure about"></textarea></div>'+
    '<button class="btn" id="f-send">Send to queue</button>'+
    '<div class="hint" id="f-err"></div>'+
    '<div class="hint"><b>How to link your track:</b> SoundCloud — upload it (private is fine) and paste the share link. Dropbox — upload the file and hit Copy Link. Test your link in an incognito tab: if it plays there, it plays for G-REX.<br><br><b>House rules:</b> one track per handle while you\'re in line. Heavy, weird, unfinished — all welcome.</div>';

  fz.querySelectorAll("#f-genre .chip").forEach(function(c){ c.onclick=function(){
    fz.querySelectorAll("#f-genre .chip").forEach(function(x){x.classList.remove("on");});
    c.classList.add("on"); genre=c.getAttribute("data-g");
  };});

  document.getElementById("f-send").onclick=function(){
    var handle=document.getElementById("f-handle").value.trim();
    var title=document.getElementById("f-title").value.trim();
    var link=document.getElementById("f-link").value.trim();
    var note=document.getElementById("f-note").value.trim();
    var err=document.getElementById("f-err");
    if(!/^https?:\/\//i.test(link) && /^(www\.|soundcloud\.|dropbox\.)/i.test(link)) link="https://"+link;
    if(!handle||!title){ err.innerHTML='<b class="bad">Need a handle and a title.</b>'; return; }
    if(!/^https?:\/\//i.test(link)){ err.innerHTML='<b class="bad">Paste the full link — it should start with http(s)://</b>'; return; }
    var btn=document.getElementById("f-send"); btn.disabled=true; btn.textContent="Sending…";

    sb.from("queue").insert({handle:handle,title:title,link:link,note:note||null,genre:genre||null})
    .then(function(r){
      if(r.error) throw r.error;
      return sb.from("queue").select("id",{count:"exact",head:true}).eq("status","queued");
    }).then(function(r){
      var pos=r.count||1;
      fz.innerHTML='<div class="confirm"><div class="big">You\'re in.</div><div class="pos">#'+pos+'</div>'+
        '<div class="sub"><b class="amber">'+esc(handle)+'</b> — "'+esc(title)+'"<br>Position in queue. Keep the stream open — G-REX pulls from the top.</div>'+
        '<button class="btn ghost" style="margin-top:18px" onclick="location.reload()">Done</button></div>';
    }).catch(function(e){
      btn.disabled=false; btn.textContent="Send to queue";
      var m=(e&&e.message)||"";
      if(/one_active_per_handle|duplicate key/i.test(m)) err.innerHTML='<b class="bad">That handle already has a track in line — one at a time.</b>';
      else if(/row-level|policy|violates/i.test(m)) err.innerHTML='<b class="bad">Submissions just closed.</b>';
      else err.innerHTML='<b class="bad">Couldn\'t send — try again in a second.</b>';
    });
  };
}

/* ---------------- DASHBOARD ---------------- */
function renderDashboard(){
  if(!CONFIGURED){ notConfigured(); return; }
  if(!PIN){ renderPinGate(); return; }
  app.innerHTML='<div class="wrap">'+
    '<div class="mast"><div class="brand">'+wordmark()+'<small>DASHBOARD</small></div><span id="pill"></span></div>'+
    nav('queue')+
    '<div class="dashbar"><button class="toggle" id="d-toggle"></button><div class="spacer"></div>'+
    '<button class="miniact" id="d-clear">Clear reviewed</button>'+
    '<button class="miniact danger" id="d-lock">Lock</button></div>'+
    '<div id="d-now"></div>'+
    '<div class="seclabel">Up next <span class="ct" id="d-upct"></span></div>'+
    '<div id="d-queue" class="rack"></div>'+
    '<div class="seclabel">Reviewed</div>'+
    '<div id="d-done" class="rack"></div>'+
    '<div class="foot"><span>v1.0.0</span><span>LIVE</span></div></div>';
  document.getElementById("d-clear").onclick=function(){ admin("clear_reviewed"); };
  document.getElementById("d-lock").onclick=function(){ PIN=""; localStorage.removeItem("pq_pin"); render(); };
  onState(function(){
    var p=document.getElementById("pill"); if(p) p.innerHTML=pill();
    var dt=document.getElementById("d-toggle");
    if(dt){ dt.innerHTML='Submissions: <b class="'+(State.open?'amber':'bad')+'">'+(State.open?'OPEN':'CLOSED')+'</b> · tap to '+(State.open?'close':'open');
      dt.onclick=function(){ admin(State.open?"close":"open"); }; }
    var c=current(), list=queued(), done=reviewed();
    var upct=document.getElementById("d-upct"); if(upct) upct.textContent=list.length;
    var now=document.getElementById("d-now"); if(!now) return;
    now.innerHTML = c ? stripView(c,"▸","live",'<button class="go" data-a="done" data-id="'+c.id+'">Done</button>')
      : '<div class="empty"><b>Nothing armed.</b>Hit Review on a strip below to put it on the overlay.</div>';
    document.getElementById("d-queue").innerHTML = list.length ?
      list.map(function(it,i){return stripView(it,i+1,"plain",
        '<button class="go" data-a="review" data-id="'+it.id+'">Review</button>'+
        '<button data-a="bump" data-id="'+it.id+'">Bump ↑</button>'+
        '<button data-a="skip" data-id="'+it.id+'">Skip</button>'+
        '<button class="kill" data-a="delete" data-id="'+it.id+'">✕</button>');}).join("")
      : '<div class="empty">'+(State.open?"Queue's empty — waiting on submissions.":"Closed and empty.")+'</div>';
    document.getElementById("d-done").innerHTML = done.length ?
      done.slice().reverse().map(function(it){return stripView(it,"·","done",
        '<button data-a="requeue" data-id="'+it.id+'">Re-queue</button>'+
        '<button class="kill" data-a="delete" data-id="'+it.id+'">✕</button>');}).join("")
      : '<div class="empty" style="padding:18px">Nothing reviewed yet this session.</div>';
    app.querySelectorAll("[data-a]").forEach(function(b){ b.onclick=function(){ admin(b.getAttribute("data-a"), b.getAttribute("data-id")); }; });
  });
}
function renderPinGate(){
  app.innerHTML='<div class="wrap"><div class="gate"><div class="g-brand">'+wordmark()+'</div>'+
    '<p>Dashboard is crew-only. Enter the PIN (it was printed when you ran setup.sql).</p>'+
    '<input id="pin" type="password" placeholder="PIN" style="text-align:center;max-width:260px;margin:0 auto;display:block">'+
    '<button class="btn" id="unlock" style="max-width:260px;margin:14px auto 0">Unlock</button>'+
    '<div class="err" id="g-err"></div></div></div>';
  function go(){
    var v=document.getElementById("pin").value.trim();
    verifyPin(v).then(function(ok){
      if(ok){ PIN=v; localStorage.setItem("pq_pin",v); render(); }
      else document.getElementById("g-err").textContent="Wrong PIN.";
    });
  }
  document.getElementById("unlock").onclick=go;
  document.getElementById("pin").onkeydown=function(e){ if(e.key==="Enter") go(); };
}

/* ---------------- OVERLAY ---------------- */
function renderOverlay(){
  if(!CONFIGURED){ notConfigured(); return; }
  document.body.classList.add("overlay");
  app.innerHTML='<div class="ovl" id="ovl"></div>';
  onState(function(){
    var c=current(), list=queued(), next=list[0], o=document.getElementById("ovl"); if(!o) return;
    if(!c){
      o.innerHTML='<div class="lab">'+BRAND+' // '+BRAND_TAIL+'</div>'+
        '<div class="now">'+(list.length?(list.length+" in the queue"):"queue is open")+'</div>'+
        (next?'<div class="next">UP NEXT &nbsp; <b>'+esc(next.handle)+'</b></div>':''); return;
    }
    o.innerHTML='<div class="lab">Now reviewing</div>'+
      '<div class="now"><span class="h">'+esc(c.handle)+'</span></div>'+
      '<div class="trk">"'+esc(c.title)+'"'+(c.genre?(' · '+esc(c.genre)):'')+'</div>'+
      '<div class="mtr"><i></i></div>'+
      (next?'<div class="next">UP NEXT &nbsp; <b>'+esc(next.handle)+'</b> &nbsp;·&nbsp; '+list.length+' waiting</div>'
           :'<div class="next">'+list.length+' waiting</div>');
  });
}

/* ---------------- mount ---------------- */
function render(){
  document.body.classList.remove("overlay");
  listeners=[];
  var r=route();
  if(r==="queue") renderDashboard();
  else if(r==="overlay") renderOverlay();
  else renderSubmit();
  emit();
}
window.addEventListener("hashchange",render);
render();
startLive();

})();
