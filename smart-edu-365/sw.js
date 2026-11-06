const CACHE_NAME='smart-edu-360-v3';
const CORE_FILES=[
 './','./index.html','./manifest.webmanifest','./icon.svg',
 './manners-course.html','./manners-listening.html','./assessment.html','./certificates.html',
 './alphabet.html','./handwriting.html','./word-writing.html','./english-course.html','./english-assessment.html','./phonics.html','./certificates.html'
];
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(CORE_FILES)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE_NAME).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
 const request=event.request;
 if(request.method!=='GET'||new URL(request.url).origin!==self.location.origin)return;
 event.respondWith(caches.match(request).then(cached=>{
  const fresh=fetch(request).then(response=>{
   if(response&&response.ok){const copy=response.clone();caches.open(CACHE_NAME).then(cache=>cache.put(request,copy));}
   return response;
  }).catch(()=>cached);
  return cached||fresh;
 }));
});