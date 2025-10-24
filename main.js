// main.js - app logic, splits from original HTML. Uses Monaco editor.
const STORAGE_KEY = 'vscode_web_files_v1';
let files = {};
let activeFile = null;
let editor = null;
let idleTimer = null;
const IDLE_MS = 1500; // auto format after 1.5s idle

// helper console
function log(msg, type='info'){
  const consoleEl = document.getElementById('console');
  const d = document.createElement('div');
  d.textContent = '['+new Date().toLocaleTimeString()+'] '+msg;
  consoleEl.appendChild(d);
  consoleEl.scrollTop = consoleEl.scrollHeight;
}

// persist/load
function saveFiles(){ localStorage.setItem(STORAGE_KEY, JSON.stringify({files, activeFile})); }
function loadFiles(){ try{ const v=JSON.parse(localStorage.getItem(STORAGE_KEY)); if(v){files=v.files||{}; activeFile=v.activeFile||null;} }catch(e){files={};} }

// UI updates
function refreshFilesList(){
  const ul = document.getElementById('files'); ul.innerHTML='';
  const names = Object.keys(files);
  if(!names.length){ ul.innerHTML = '<div class="empty">No files yet</div>'; return; }
  names.forEach(name=>{
    const li = document.createElement('li');
    li.textContent = name;
    if(name===activeFile) li.classList.add('active');
    li.onclick = ()=> openFile(name);
    ul.appendChild(li);
  });
}

function refreshTabs(){
  const t = document.getElementById('tabs'); t.innerHTML='';
  Object.keys(files).forEach(name=>{
    const tab = document.createElement('div'); tab.className = 'tab';
    if(name===activeFile) tab.classList.add('active');
    tab.textContent = name;
    tab.onclick = ()=> openFile(name);
    t.appendChild(tab);
  });
  updateFileInfo();
}

function updateFileInfo(){
  const fi = document.getElementById('currentFile');
  fi.textContent = activeFile || 'No file open';
  document.getElementById('statusLang').textContent = activeFile? activeFile.split('.').pop().toUpperCase() : '-';
}

function createNewFile(name){
  if(!name) return;
  if(files[name]) return openFile(name);
  const ext = name.split('.').pop().toLowerCase();
  const template = ext==='html'? '<!doctype html>\\n<html>\\n<head>\\n<meta charset=\"utf-8\">\\n</head>\\n<body>\\n\\n</body>\\n</html>': '';
  files[name] = {content: template, lang: ext==='js'?'javascript':(ext==='py'?'python':(ext==='css'?'css':ext))};
  activeFile = name;
  saveFiles(); refreshFilesList(); refreshTabs(); openFile(name);
  log('Created '+name);
}

function openFile(name){
  activeFile = name;
  const data = files[name] || {content:'', lang:'plaintext'};
  if(editor){
    const model = monaco.editor.getModels().find(m=>m.uri.path===('/'+name));
    if(model){
      editor.setModel(model);
    } else {
      const uri = monaco.Uri.parse('inmemory://model/'+name);
      const newModel = monaco.editor.createModel(data.content, data.lang, uri);
      editor.setModel(newModel);
    }
  }
  saveFiles(); refreshFilesList(); refreshTabs(); updateFileInfo();
}

function autoFormatIfReady(){
  if(!activeFile) return;
  const model = editor.getModel();
  const ext = activeFile.split('.').pop().toLowerCase();
  const code = model.getValue();
  if(!window.prettier) return;
  try{
    let parser = 'babel';
    if(ext==='html' || ext==='htm') parser='html';
    if(ext==='css') parser='css';
    if(ext==='js') parser='babel';
    const formatted = window.formatWithPrettier(code, parser);
    if(formatted && formatted!==code){
      const pos = editor.getPosition();
      model.setValue(formatted);
      editor.setPosition(pos);
      log('Auto-formatted '+activeFile);
    }
  }catch(e){ log('Auto-format failed: '+e.message); }
}

// Monaco setup
require.config({paths:{vs: window.MONACO_BASE+'/vs'}});
require(['vs/editor/editor.main'], function() {
  editor = monaco.editor.create(document.getElementById('editor'), {
    value: '',
    language: 'html',
    theme: 'vs-dark',
    automaticLayout: true,
    fontSize: 14,
    minimap: {enabled:true}
  });

  // load stored files
  loadFiles();
  if(!Object.keys(files).length){
    files['index.html'] = {content: '<!doctype html>\\n<html>\\n<head>\\n<meta charset=\"utf-8\">\\n<title>Welcome</title>\\n</head>\\n<body>\\n<h1>Hello</h1>\\n</body>\\n</html>', lang:'html'};
    activeFile = 'index.html';
  }

  // create models
  Object.keys(files).forEach(name=>{
    const uri = monaco.Uri.parse('inmemory://model/'+name);
    monaco.editor.createModel(files[name].content, files[name].lang, uri);
  });

  if(activeFile) openFile(activeFile);

  // on change save and schedule auto-format
  editor.onDidChangeModelContent(()=> {
    const model = editor.getModel();
    const name = model.uri.path.substring(1);
    files[name].content = model.getValue();
    saveFiles();
    updateFileInfo();
    if(idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(autoFormatIfReady, IDLE_MS);
  });

  editor.onDidChangeCursorPosition(()=> {
    const pos = editor.getPosition();
    document.getElementById('statusLine').textContent = 'Ln '+pos.lineNumber+', Col '+pos.column;
    const model = editor.getModel();
    document.getElementById('statusChars').textContent = model.getValue().length + ' chars';
  });

  log('Editor ready');
});

// UI bindings
document.getElementById('newFileBtn').onclick = ()=> {
  const name = prompt('File name (e.g., script.js, style.css):');
  if(name) createNewFile(name);
};
document.getElementById('formatBtn').onclick = ()=> {
  if(!activeFile) return;
  const model = editor.getModel();
  const name = activeFile;
  const ext = name.split('.').pop().toLowerCase();
  const code = model.getValue();
  let parser = 'babel';
  if(ext==='html') parser='html';
  try{
    if(window.prettier){
      const formatted = window.formatWithPrettier(code, parser);
      if(formatted) model.setValue(formatted);
      log('Formatted '+name);
    } else {
      log('Prettier not loaded yet');
    }
  }catch(e){ log('Format error: '+e.message); }
};
document.getElementById('runBtn').onclick = ()=> {
  if(!activeFile) return;
  const ext = activeFile.split('.').pop().toLowerCase();
  const code = files[activeFile].content;
  if(ext==='html'){
    document.getElementById('preview').srcdoc = code;
    log('Preview updated');
  } else if(ext==='js'){
    const html = '<!doctype html><html><body><script>'+code+'</script></body></html>';
    document.getElementById('preview').srcdoc = html;
    log('JS executed in preview');
  } else {
    log('Run not supported for this file type');
  }
};
document.getElementById('importBtn').onclick = ()=> {
  const input = document.createElement('input'); input.type='file'; input.multiple=true;
  input.onchange = (e)=> {
    Array.from(e.target.files).forEach(f=>{
      const r = new FileReader();
      r.onload = ()=> {
        files[f.name] = {content: r.result, lang: f.name.split('.').pop()};
        saveFiles(); refreshFilesList(); refreshTabs(); openFile(f.name);
        log('Imported '+f.name);
      };
      r.readAsText(f);
    });
  };
  input.click();
};
document.getElementById('exportBtn').onclick = ()=> {
  if(!activeFile) return;
  const blob = new Blob([files[activeFile].content], {type:'text/plain'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = activeFile; a.click();
  log('Exported '+activeFile);
};

// Keep UI lists in sync
setInterval(()=>{ refreshFilesList(); refreshTabs(); }, 1000);
