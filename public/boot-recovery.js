(function(){
  var KEY='tarabil.boot.recovery.v31';
  function shellReady(){ return !!document.querySelector('.shell-v2, .mobile-appbar, .desktop-sidebar'); }
  async function recover(){
    if(shellReady()) { try{sessionStorage.removeItem(KEY)}catch(e){}; return; }
    var attempted=false;
    try{attempted=sessionStorage.getItem(KEY)==='1'}catch(e){}
    if(!attempted){
      try{sessionStorage.setItem(KEY,'1')}catch(e){}
      try{
        if('serviceWorker' in navigator){
          var regs=await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map(function(r){return r.unregister()}));
        }
      }catch(e){}
      try{
        if(window.caches){
          var keys=await caches.keys();
          await Promise.all(keys.filter(function(k){return k.indexOf('tarabil-')===0}).map(function(k){return caches.delete(k)}));
        }
      }catch(e){}
      location.replace(location.href.split('#')[0] + (location.search ? '&' : '?') + '_boot=' + Date.now());
      return;
    }
    // Do not leave the user with a blank screen if boot still fails.
    var root=document.getElementById('__nuxt') || document.body;
    if(root && !shellReady()){
      root.innerHTML='<div dir="rtl" style="font-family:Segoe UI,Tahoma,Arial,sans-serif;min-height:100vh;display:grid;place-items:center;background:#f4f7f8;color:#172124;padding:24px"><div style="max-width:520px;background:#fff;border:1px solid #dce5e8;border-radius:16px;padding:22px;box-shadow:0 12px 36px rgba(16,40,46,.08)"><h2 style="margin:0 0 8px">تعذر تشغيل واجهة النظام</h2><p style="margin:0 0 16px;color:#6c7a80;line-height:1.8">تم تنظيف الكاش تلقائياً. اضغط إعادة التحميل، وإذا استمرت المشكلة افتح أدوات المطور وأرسل صورة من Console.</p><button onclick="sessionStorage.removeItem(\''+KEY+'\');location.reload()" style="border:0;border-radius:10px;padding:10px 15px;background:#0f766e;color:white;font-weight:700;cursor:pointer">إعادة التحميل</button></div></div>';
    }
  }
  window.addEventListener('load', function(){ setTimeout(recover, 2800); });
})();
