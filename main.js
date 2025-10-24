// main.js - app logic with Pyodide, resizable preview, toggles, delete/close, and "!" shortcut
const STORAGE_KEY = 'vscode_web_files_v2';
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
    const span = document.createElement('span'); span.className='file-name'; span.textContent = name;
    span.onclick = ()=> openFile(name);
    const actions = document.createElement('div'); actions.className='file-actions';
    const del = document.createElement('button'); del.textContent='Delete'; del.onclick = (e)=> { e.stopPropagation(); deleteFile(name); };
    actions.appendChild(del);
    li.appendChild(span); li.appendChild(actions);
    if(name===activeFile) li.classList.add('active');
    ul.appendChild(li);
  });
}

function refreshTabs(){
  const t = document.getElementById('tabs'); t.innerHTML='';
  Object.keys(files).forEach(name=>{
    const tab = document.createElement('div'); tab.className = 'tab';
    if(name===activeFile) tab.classList.add('active');
    const title = document.createElement('span'); title.textContent = name; title.onclick = ()=> openFile(name);
    const closeBtn = document.createElement('button'); closeBtn.className='close-btn'; closeBtn.textContent='✕'; closeBtn.onclick=(e)=>{ e.stopPropagation(); closeFile(name); };
    tab.appendChild(title); tab.appendChild(closeBtn);
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

function deleteFile(name){
  if(!files[name]) return;
  delete files[name];
  if(activeFile === name) activeFile = Object.keys(files)[0] || null;
  const model = monaco.editor.getModels().find(m=>m.uri.path === '/'+name);
  if(model) model.dispose();
  saveFiles(); refreshFilesList(); refreshTabs(); if(activeFile) openFile(activeFile); else { editor.setValue(''); updateFileInfo(); }
  log('Deleted '+name);
}

function closeFile(name){
  if(!files[name]) return;
  if(activeFile === name){
    const remaining = Object.keys(files).filter(n=>n!==name);
    activeFile = remaining[0] || null;
    if(activeFile) openFile(activeFile);
    else { editor.setValue(''); updateFileInfo(); }
  }
  refreshTabs();
  saveFiles();
}

function openFile(name){
  activeFile = name;
  const data = files[name] || {content:'', lang:'plaintext'};
  if(editor){
    const existing = monaco.editor.getModels().find(m=>m.uri.path === '/'+name);
    if(existing){
      editor.setModel(existing);
    } else {
      const uri = monaco.Uri.parse('inmemory://model/'+name);
      const model = monaco.editor.createModel(data.content, data.lang, uri);
      editor.setModel(model);
    }
    monaco.editor.setModelLanguage(editor.getModel(), data.lang);
  }
  saveFiles(); refreshFilesList(); refreshTabs(); updateFileInfo();
  updatePreviewOrConsole();
}

function updatePreviewOrConsole(){
  const ext = activeFile ? activeFile.split('.').pop().toLowerCase() : null;
  if(!ext) return;
  if(ext === 'html'){
    document.getElementById('preview').classList.remove('hidden');
    document.getElementById('preview-header').classList.remove('hidden');
    document.getElementById('preview').style.display = 'block';
  }
}

async function autoFormatIfReady(){
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
    files['index.html'] = {content: '<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Document</title>
</head>
<body>
  
</body>
</html>
', lang:'html'};
    activeFile = 'index.html';
  }

  Object.keys(files).forEach(name=>{
    const uri = monaco.Uri.parse('inmemory://model/'+name);
    monaco.editor.createModel(files[name].content, files[name].lang, uri);
  });

  if(activeFile) openFile(activeFile);

  editor.onDidChangeModelContent((e)=> {
    const model = editor.getModel();
    const name = model.uri.path.substring(1);
    files[name].content = model.getValue();
    saveFiles();
    updateFileInfo();
    if(idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(autoFormatIfReady, IDLE_MS);

    const val = model.getValue();
    if(val.trim() === '!'){
      const template = '<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Document</title>
</head>
<body>
  
</body>
</html>
';
      model.setValue(template);
      editor.setPosition({lineNumber:9, column:3});
      log('Expanded "!" to HTML template');
    }
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
document.getElementById('runBtn').onclick = async ()=> {
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
  } else if(ext==='py'){
    await runPython(code);
  } else {
    log('Run not supported for this file type, use Console');
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

document.getElementById('clearConsole').onclick = ()=> {
  document.getElementById('console').innerHTML = '';
  log('Console cleared');
};

document.getElementById('togglePreviewBtn').onclick = ()=> {
  const p = document.getElementById('preview');
  const h = document.getElementById('preview-header');
  p.classList.toggle('hidden'); h.classList.toggle('hidden');
};
document.getElementById('toggleConsoleBtn').onclick = ()=> {
  const c = document.getElementById('console');
  const h = document.getElementById('terminal-header');
  c.classList.toggle('hidden'); h.classList.toggle('hidden');
};
document.getElementById('refreshPreview').onclick = ()=> {
  if(activeFile && activeFile.split('.').pop().toLowerCase()==='html'){
    document.getElementById('preview').srcdoc = files[activeFile].content;
    log('Preview refreshed');
  }
};

// Resizer logic for right panel
(function(){
  const resizer = document.getElementById('resizer');
  let dragging = false;
  resizer.addEventListener('mousedown', (e)=>{
    dragging = true;
    document.body.style.cursor = 'ew-resize';
  });
  window.addEventListener('mousemove', (e)=>{
    if(!dragging) return;
    const rect = document.getElementById('main').getBoundingClientRect();
    const newWidth = Math.max(240, rect.right - e.clientX);
    document.getElementById('main').style.gridTemplateColumns = `260px 1fr ${newWidth}px`;
  });
  window.addEventListener('mouseup', ()=>{ dragging=false; document.body.style.cursor='default'; });
})();

// Pyodide runner
async function runPython(code){
  try{
    if(!window.pyodide){
      log('Loading Python runtime (Pyodide)...');
      window.pyodide = await loadPyodide({indexURL:'https://cdn.jsdelivr.net/pyodide/v0.23.4/full/'});
      log('Pyodide loaded');
    }
    let output = await window.pyodide.runPythonAsync(code);
    if(output !== undefined) log('Python output: '+output);
    else log('Python executed');
  }catch(e){
    log('Python error: '+(e.message || e));
  }
}

// keep UI lists in sync
setInterval(()=>{ refreshFilesList(); refreshTabs(); }, 800);

// keyboard shortcuts
window.addEventListener('keydown', (e)=>{
  if((e.ctrlKey || e.metaKey) && e.key === 'Enter'){
    e.preventDefault();
    document.getElementById('runBtn').click();
  }
  if((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase()==='f'){
    e.preventDefault();
    document.getElementById('formatBtn').click();
  }
});
