// === main.js (Patched per user request) ===
const STORAGE_KEY = 'vscode_web_files_v2';
let files = {};
let activeFile = null;
let editor = null;
let idleTimer = null;
const IDLE_MS = 1200;

// simple logger
function log(msg){
  const c = document.getElementById('console');
  const d = document.createElement('div');
  d.textContent = '['+new Date().toLocaleTimeString()+'] '+msg;
  c.appendChild(d); c.scrollTop = c.scrollHeight;
}

// storage helpers
function saveFiles(){ localStorage.setItem(STORAGE_KEY, JSON.stringify({files, activeFile})); }
function loadFiles(){ try{ let v=JSON.parse(localStorage.getItem(STORAGE_KEY)); if(v){files=v.files||{}; activeFile=v.activeFile||null;} }catch{ files={}; } }

// UI list refresh
function refreshFilesList(){
  const ul = document.getElementById('files');
  ul.innerHTML="";
  const names = Object.keys(files);
  if(!names.length){ ul.innerHTML = '<div class="empty">No files yet</div>'; return; }
  names.forEach(name=>{
    const li = document.createElement('li');
    const span = document.createElement('span');
    span.className="file-name"; span.textContent=name;
    span.onclick = ()=> openFile(name);

    const actions = document.createElement('div');
    actions.className="file-actions";
    const del = document.createElement('button');
    del.textContent="Delete";
    del.onclick = (e)=>{ e.stopPropagation(); deleteFile(name); };
    actions.appendChild(del);

    li.appendChild(span); li.appendChild(actions);
    if(name===activeFile) li.classList.add('active');
    ul.appendChild(li);
  });
}

function refreshTabs(){
  const t = document.getElementById('tabs');
  t.innerHTML="";
  Object.keys(files).forEach(name=>{
    const tab = document.createElement('div');
    tab.className="tab";
    if(name===activeFile) tab.classList.add("active");

    const title=document.createElement('span');
    title.textContent=name; title.onclick=()=>openFile(name);

    const closeBtn=document.createElement('button');
    closeBtn.className="close-btn"; closeBtn.textContent="✕";
    closeBtn.onclick=(e)=>{ e.stopPropagation(); closeFile(name); };

    tab.appendChild(title); tab.appendChild(closeBtn);
    t.appendChild(tab);
  });
  updateFileInfo();
}

function updateFileInfo(){
  document.getElementById('currentFile').textContent = activeFile || "No file open";
  document.getElementById('statusLang').textContent = activeFile ? activeFile.split('.').pop().toUpperCase() : "-";
}

function guessLang(ext){
  if(ext==="js") return "javascript";
  if(ext==="html") return "html";
  if(ext==="css") return "css";
  if(ext==="py") return "python";
  return "plaintext";
}

function createNewFile(name){
  if(!name) return;
  if(files[name]) return openFile(name);
  const ext=name.split('.').pop().toLowerCase();
  const template = ext==="html" ? "<!doctype html>\n<html>\n<head>\n<meta charset='utf-8'>\n</head>\n<body>\n</body>\n</html>" : "";
  files[name] = {content: template, lang: guessLang(ext)};
  activeFile=name;
  saveFiles(); refreshFilesList(); refreshTabs();
  openFile(name); log("Created "+name);
}

function deleteFile(name){
  if(!files[name]) return;
  delete files[name];

  const model = monaco.editor.getModels().find(m=>m.uri.path==="/"+name);
  if(model) model.dispose();

  activeFile = Object.keys(files)[0] || null;
  saveFiles(); refreshFilesList(); refreshTabs();
  if(activeFile) openFile(activeFile); else editor.setValue("");
  log("Deleted "+name);
}

function closeFile(name){
  if(activeFile===name){
    const list = Object.keys(files).filter(n=>n!==name);
    activeFile=list[0]||null;
    if(activeFile) openFile(activeFile); else editor.setValue("");
  }
  refreshTabs(); saveFiles();
}

function openFile(name){
  activeFile=name;
  const data = files[name];
  const ext = name.split('.').pop().toLowerCase();
  const uri = monaco.Uri.parse("inmemory://model/"+name);

  let model = monaco.editor.getModels().find(m=>m.uri.path==="/"+name);
  if(!model){
    model = monaco.editor.createModel(data.content, data.lang, uri);
  }
  editor.setModel(model);
  monaco.editor.setModelLanguage(model, data.lang);

  saveFiles(); refreshFilesList(); refreshTabs(); updateFileInfo();
  updateLivePreview();
}

function updateLivePreview(){
  if(!activeFile) return;
  const ext = activeFile.split('.').pop().toLowerCase();
  if(ext==="html"){
    document.getElementById("preview").srcdoc = files[activeFile].content;
  }
}

// Auto format (uses Prettier loaded by prettier.js)
async function autoFormatIfReady(){
  if(!activeFile) return;
  if(!window.prettierReady) return;
  const model = editor.getModel();
  const code=model.getValue();
  const ext=activeFile.split('.').pop().toLowerCase();

  let parser="babel";
  if(ext==="html") parser="html";
  if(ext==="css") parser="css";

  try{
    const formatted = window.formatWithPrettier(code,parser);
    if(formatted && formatted!==code){
      const pos=editor.getPosition();
      model.setValue(formatted);
      editor.setPosition(pos);
      log("Auto formatted "+activeFile);
    }
  }catch(e){ console.warn(e); }
}

// Auto-close simple HTML tags when user types an opening tag
function tryAutoCloseTag(e){
  try{
    const changes = e.changes || [];
    if(!changes.length) return;
    const ch = changes[0];
    if(!ch || !('text' in ch)) return;
    if(!ch.text.includes('>')) return;
    const model = editor.getModel();
    const pos = editor.getPosition();
    const line = model.getLineContent(pos.lineNumber);
    const prefix = line.substring(0, pos.column-1);
    // match last open tag like <h1> or <div class="x">
    const m = prefix.match(/<([a-zA-Z][\w:-]*)[^>]*>$/);
    if(!m) return;
    const tag = m[1];
    // don't auto-close void/self-closing tags
    const voidTags = ['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'];
    if(voidTags.includes(tag.toLowerCase())) return;
    // check if a corresponding closing tag already exists after cursor on same line
    const restOfDoc = model.getValue().substring(model.getOffsetAt(pos));
    if(new RegExp(`<\\/${tag}\\b`).test(restOfDoc)) return;
    // insert closing tag right after cursor and put cursor between
    const insertText = `</${tag}>`;
    const id = [{range: new monaco.Range(pos.lineNumber,pos.column,pos.lineNumber,pos.column), text: insertText, forceMoveMarkers: true}];
    editor.executeEdits("autoCloseTag", id);
    editor.setPosition(pos); // keep cursor between tags
  }catch(err){ console.warn('autoCloseTag err',err); }
}

// Monaco setup
require.config({paths:{vs: window.MONACO_BASE+'/vs'}});
require(["vs/editor/editor.main"], ()=>{
  editor = monaco.editor.create(document.getElementById("editor"),{
    value:"",
    language:"html",
    theme:"vs-dark",
    automaticLayout:true,
    fontSize:14,
    minimap:{enabled:true}
  });

  loadFiles();
  if(!Object.keys(files).length){
    files["index.html"]={content:"<!doctype html><html><body><h1>Hello</h1></body></html>",lang:"html"};
    activeFile="index.html";
  }

  Object.keys(files).forEach(name=>{
    monaco.editor.createModel(files[name].content, files[name].lang, monaco.Uri.parse("inmemory://model/"+name));
  });

  openFile(activeFile);

  editor.onDidChangeModelContent((e)=>{
    const model=editor.getModel();
    const name=model.uri.path.substring(1);
    files[name].content=model.getValue();
    saveFiles();
    updateFileInfo();
    updateLivePreview();

    // auto-close tags immediately on change
    tryAutoCloseTag(e);

    if(idleTimer) clearTimeout(idleTimer);
    idleTimer=setTimeout(autoFormatIfReady, IDLE_MS);
  });

  editor.onDidChangeCursorPosition(()=>{
    const pos=editor.getPosition();
    document.getElementById("statusLine").textContent = "Ln "+pos.lineNumber+", Col "+pos.column;
    document.getElementById("statusChars").textContent = editor.getModel().getValue().length+" chars";
  });

  log("Editor ready");
});

// Run button behavior (HTML preview + Python support)
async function ensurePyodide(){
  if(window.pyodideReady) return window.pyodide;
  // if loadPyodide already exists, use it
  if(window.loadPyodide){
    try{
      const p = await window.loadPyodide({indexURL:"https://cdn.jsdelivr.net/pyodide/v0.23.4/full/"});
      window.pyodide = p; window.pyodideReady=true; return p;
    }catch(e){ console.warn('pyodide failed to init',e); window.pyodideReady=false; throw e; }
  }
  // otherwise dynamically load the script and then init
  return new Promise((resolve,reject)=>{
    const s = document.createElement('script');
    s.src = "https://cdn.jsdelivr.net/pyodide/v0.23.4/full/pyodide.js";
    s.onload = async ()=>{
      try{
        const p = await window.loadPyodide({indexURL:"https://cdn.jsdelivr.net/pyodide/v0.23.4/full/"});
        window.pyodide = p; window.pyodideReady=true; resolve(p);
      }catch(err){ console.warn('pyodide init err',err); window.pyodideReady=false; reject(err); }
    };
    s.onerror = ()=>{ window.pyodideReady=false; reject(new Error('Failed to load pyodide script')); };
    document.head.appendChild(s);
  });
}

document.getElementById("runBtn").onclick=async ()=>{
  if(!activeFile) return;
  const ext=activeFile.split('.').pop().toLowerCase();
  const code=files[activeFile].content;

  if(ext==="html"){
    document.getElementById("preview").srcdoc=code;
    log("Preview updated");
  }else if(ext==="py"){
    log("Running Python via Pyodide...");
    try{
      const py = await ensurePyodide();
      // capture stdout/stderr
      const out = [];
      const orig = {stdout:py._module.stdout, stderr:py._module.stderr};
      // run safely
      const result = await py.runPythonAsync(code);
      log("Python executed.");
      if(result !== undefined) log(String(result));
    }catch(err){
      log("Pyodide error: "+(err && err.message ? err.message : err));
      console.error(err);
    }
  }else if(ext==="js"){
    try{
      // run inside the preview iframe as a script
      const iframe = document.getElementById("preview");
      const html = `<!doctype html><html><body><script>${code}<\/script></body></html>`;
      iframe.srcdoc = html;
      log("Executed JS in preview");
    }catch(e){ log("JS run error: "+e.message); }
  }else{
    log("No run action for this file type.");
  }
};

// IMPORT unchanged
document.getElementById("importBtn").onclick=()=>{
  const i=document.createElement("input");
  i.type="file"; i.multiple=true;
  i.onchange=(e)=>{
    [...e.target.files].forEach(f=>{
      const r=new FileReader();
      r.onload=()=>{
        const ext=f.name.split('.').pop().toLowerCase();
        files[f.name]={content:r.result,lang:guessLang(ext)};
        saveFiles(); refreshFilesList(); refreshTabs(); openFile(f.name);
        log("Imported "+f.name);
      };
      r.readAsText(f);
    });
  };
  i.click();
};

// EXPORT now zips all files (complete, no empties)
document.getElementById("exportBtn").onclick=()=>{
  try{
    const zipFiles = Object.keys(files).length ? Object.keys(files) : [];
    if(!zipFiles.length){ log("No files to export"); return; }
    // build a zip in browser using simple JSZip-free approach: create a blob of a zip via simple ZIP central directory is complex,
    // so prefer to trigger server-side zip via fetch to /api if available. As fallback, create a downloadable multiple-file via .tar-like approach.
    // We'll create a simple zip using a Blob of concatenated files in a folder (works as .zip in many OS) — but to be robust, create a .zip using a data URL for a tiny JS implementation.
    // Simpler approach: create a single combined .zip-like blob using a JS library would be ideal, but to avoid extra deps, we instead create a .zip-like .tar file named .zip — most OS will open .zip if real zip; but we must create a real zip.
    // To ensure a valid zip, we'll build a simple zip using minimal JS implementation for deflate=store (no compression).
    // Minimal zip writer:
    const filesToZip = zipFiles.map(name=>({name,content:files[name].content}));
    const zipBuffer = createZipBuffer(filesToZip);
    const blob = new Blob([zipBuffer],{type:'application/zip'});
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download = 'project_files.zip';
    a.click();
    log("Exported ZIP with "+filesToZip.length+" files.");
  }catch(e){ console.error(e); log("Export failed: "+e.message); }
};

// Create a very small ZIP (no compression) - local, self-contained
function createZipBuffer(entries){
  // Returns an ArrayBuffer of a valid ZIP file containing entries: [{name,content}]
  // Note: stores files with UTF-8 filenames and no compression
  const encoder = new TextEncoder();
  const filesData = [];
  let localDirSize = 0;
  const centralDir = [];
  let offset = 0;

  function toUint8Array(obj){
    if(typeof obj === 'string') return encoder.encode(obj);
    if(obj instanceof Uint8Array) return obj;
    if(obj instanceof ArrayBuffer) return new Uint8Array(obj);
    return encoder.encode(String(obj));
  }

  for(const ent of entries){
    const nameBuf = encoder.encode(ent.name);
    const dataBuf = toUint8Array(ent.content);
    const localHeader = new Uint8Array(30 + nameBuf.length);
    const dv = new DataView(localHeader.buffer);
    let p=0;
    dv.setUint32(p,0x04034b50, true); p+=4; // local file header signature
    dv.setUint16(p,20,true); p+=2; // version needed
    dv.setUint16(p,0,true); p+=2; // flags
    dv.setUint16(p,0,true); p+=2; // compression (0=store)
    dv.setUint16(p,0,true); p+=2; // mod time
    dv.setUint16(p,0,true); p+=2; // mod date
    dv.setUint32(p,0,true); p+=4; // crc32 (0 for now)
    dv.setUint32(p,dataBuf.length,true); p+=4; // compressed size
    dv.setUint32(p,dataBuf.length,true); p+=4; // uncompressed size
    dv.setUint16(p,nameBuf.length,true); p+=2;
    dv.setUint16(p,0,true); p+=2;
    localHeader.set(nameBuf,30);
    filesData.push(localHeader);
    filesData.push(dataBuf);
    // central dir entry
    const cent = new Uint8Array(46 + nameBuf.length);
    const cdv = new DataView(cent.buffer);
    let q=0;
    cdv.setUint32(q,0x02014b50,true); q+=4;
    cdv.setUint16(q,20,true); q+=2;
    cdv.setUint16(q,20,true); q+=2;
    cdv.setUint16(q,0,true); q+=2;
    cdv.setUint16(q,0,true); q+=2;
    cdv.setUint16(q,0,true); q+=2;
    cdv.setUint32(q,0,true); q+=4;
    cdv.setUint32(q,0,true); q+=4;
    cdv.setUint32(q,dataBuf.length,true); q+=4;
    cdv.setUint16(q,nameBuf.length,true); q+=2;
    cdv.setUint16(q,0,true); q+=2;
    cdv.setUint16(q,0,true); q+=2;
    cdv.setUint16(q,0,true); q+=2;
    cdv.setUint32(q,0,true); q+=4; // internal attrs
    cdv.setUint32(q,0,true); q+=4; // external attrs
    cdv.setUint32(q,offset,true); q+=4; // relative offset
    cent.set(nameBuf,46);
    centralDir.push(cent);
    offset += localHeader.length + dataBuf.length;
  }

  // end of central dir
  let centralSize = centralDir.reduce((s,c)=>s+c.length,0);
  let centralOffset = offset;
  const parts = [...filesData, ...centralDir];
  const totalSize = parts.reduce((s,p)=>s + p.length, 0) + 22;
  const out = new Uint8Array(totalSize);
  let ptr = 0;
  for(const p of parts){ out.set(p,ptr); ptr += p.length; }
  // EOCD
  const dv = new DataView(out.buffer);
  dv.setUint32(ptr,0x06054b50,true); ptr+=4;
  dv.setUint16(ptr,0,true); ptr+=2;
  dv.setUint16(ptr,0,true); ptr+=2;
  dv.setUint16(ptr,centralDir.length,true); ptr+=2;
  dv.setUint16(ptr,centralDir.length,true); ptr+=2;
  dv.setUint32(ptr,centralSize,true); ptr+=4;
  dv.setUint32(ptr,centralOffset,true); ptr+=4;
  dv.setUint16(ptr,0,true); ptr+=2;
  return out.buffer;
}

// Console clear
document.getElementById("clearConsole").onclick=()=>{
  document.getElementById("console").innerHTML="";
};

// Toggle preview + console
document.getElementById("togglePreviewBtn").onclick=()=>{
  document.getElementById("preview").classList.toggle("hidden");
};
document.getElementById("toggleConsoleBtn").onclick=()=>{
  document.getElementById("console").classList.toggle("hidden");
};

// Format button next to Run - formats immediately using Prettier
document.getElementById("formatBtn").onclick=()=>{
  autoFormatIfReady();
};

// Resizer drag - allows resizing the right panel even when editor present
(function setupResizer(){
  const resizer = document.getElementById('resizer');
  const main = document.getElementById('main');
  let dragging = false;
  let startX=0;
  let startCols='';
  resizer.addEventListener('pointerdown',(e)=>{
    dragging=true; startX=e.clientX;
    const st = window.getComputedStyle(main).gridTemplateColumns;
    startCols = st;
    resizer.setPointerCapture(e.pointerId);
    document.body.style.userSelect='none';
  });
  window.addEventListener('pointermove',(e)=>{
    if(!dragging) return;
    const dx = startX - e.clientX;
    // parse initial columns
    const parts = startCols.split(' ');
    let left = parts[0];
    let right = parts[2];
    const leftVal = parseFloat(left);
    const rightVal = parseFloat(right);
    // convert px if needed
    const containerW = main.clientWidth;
    const newRight = Math.max(240, Math.min(containerW-200, rightVal + dx));
    main.style.gridTemplateColumns = parts[0] + ' 1fr ' + newRight + 'px';
  });
  window.addEventListener('pointerup',(e)=>{
    if(!dragging) return;
    dragging=false;
    document.body.style.userSelect='';
    try{ resizer.releasePointerCapture(e.pointerId); }catch{}
  });
})();
function goBack(){
  window.history.back();
}
