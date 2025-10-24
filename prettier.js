// prettier.js - loads Prettier and plugins (uses CDN). Exposes `formatWithPrettier(code, parser)`
(function(){
  const scripts = [
    'https://unpkg.com/prettier@2.8.8/standalone.js',
    'https://unpkg.com/prettier@2.8.8/parser-html.js',
    'https://unpkg.com/prettier@2.8.8/parser-babel.js',
    'https://unpkg.com/prettier@2.8.8/parser-postcss.js'
  ];
  window.prettierReady = false;
  function loadNext(){
    if(!scripts.length){ window.prettierReady = true; return; }
    const s = document.createElement('script');
    s.src = scripts.shift();
    s.onload = loadNext;
    s.onerror = loadNext;
    document.head.appendChild(s);
  }
  loadNext();
  window.formatWithPrettier = function(code, parser){
    if(!window.prettier){ return code; }
    try{
      const opt = {parser: parser, plugins: prettierPlugins || [], printWidth:80, tabWidth:2, singleQuote:true};
      return prettier.format(code, opt);
    }catch(e){
      console.warn('Prettier format failed', e);
      return code;
    }
  };
})();