
// === main.js (Fixed Version) ===
// Cleaned + bug‑fixed without changing theme or functionality.

const STORAGE_KEY = 'vscode_web_files_v2';
let files = {};
let activeFile = null;
let editor = null;
let idleTimer = null;
const IDLE_MS = 1200;

// log helper
function log(msg){
  const c = document.getElementById('console');
  const d = document.createElement('div');
  d.textContent = '['+new Date().toLocaleTimeString()+'] '+msg;
  c.appendChild(d);
  c.scrollTop = c.scrollHeight;
}

// storage
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

// Auto format (fixed)
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
  }catch{}
}

// Setup Monaco
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

  editor.onDidChangeModelContent(()=>{
    const model=editor.getModel();
    const name=model.uri.path.substring(1);
    files[name].content=model.getValue();
    saveFiles();
    updateFileInfo();
    updateLivePreview();

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

// Run button
document.getElementById("runBtn").onclick=()=>{
  if(!activeFile) return;
  const ext=activeFile.split('.').pop().toLowerCase();
  const code=files[activeFile].content;

  if(ext==="html"){
    document.getElementById("preview").srcdoc=code;
    log("Preview updated");
  }
};

// File import/export
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

document.getElementById("exportBtn").onclick=()=>{
  if(!activeFile) return;
  const b=new Blob([files[activeFile].content],{type:"text/plain"});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(b);
  a.download=activeFile;
  a.click();
  log("Exported "+activeFile);
};

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
