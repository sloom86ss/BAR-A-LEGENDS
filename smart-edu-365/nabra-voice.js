// Nabra Arabic TTS: resilient loading for mobile browsers, with a WASM fallback.
const status = document.createElement('p');
status.className = 'note';
status.id = 'nabraStatus';
status.textContent = 'الصوت العربي الطبيعي مجاني ويُحمَّل عند الطلب؛ يحتاج اتصالاً بالإنترنت ومساحة تخزين كافية.';
const toolRows = document.querySelectorAll('.tools');
const toolsRow = toolRows.length > 1 ? toolRows[1] : toolRows[0];
const button = document.createElement('button');
button.type = 'button';
button.className = 'btn gold';
button.id = 'nabraLoad';
button.textContent = '🎙️ تحميل الصوت العربي الطبيعي';
if (toolsRow) {
  toolsRow.appendChild(button);
  toolsRow.insertAdjacentElement('afterend', status);
} else {
  console.error('Nabra: لم يتم العثور على منطقة أزرار الأدوات.');
}
let engine = null;
let loading = false;
button.addEventListener('click', async () => {
  if (loading) return;
  if (engine) {
    status.textContent = 'الصوت العربي الطبيعي جاهز. اضغط «اقرأ آخر شرح» للتجربة.';
    return;
  }
  loading = true;
  button.disabled = true;
  button.textContent = '⏳ جارٍ تحميل الصوت...';
  status.textContent = 'جارٍ الاتصال بمصدر الصوت. أبقِ الصفحة مفتوحة ولا تغلق المتصفح.';
  try {
    const { NabraTTS } = await import('https://cdn.jsdelivr.net/npm/nabra-tts@0/+esm');
    const progress = ({ file, loaded, total }) => {
      const pct = total ? Math.round(loaded / total * 100) : 0;
      status.textContent = 'تحميل الصوت: ' + pct + '% — ' + (file || 'ملفات التشغيل');
    };
    try {
      // Small model first; automatic backend selection where supported.
      engine = await NabraTTS.load({ dtype: 'fp16', device: 'auto', cache: true, onProgress: progress });
    } catch (firstError) {
      console.warn('Nabra fp16/auto failed; retrying with the compatible WASM backend.', firstError);
      status.textContent = 'نجرب وضع التوافق مع الهاتف...';
      engine = await NabraTTS.load({ dtype: 'fp32', device: 'wasm', cache: true, onProgress: progress });
    }
    window.SmartEduNabraSpeak = async (text) => {
      try { await engine.speak(String(text)); return true; }
      catch (e) { console.error('Nabra speech error:', e); return false; }
    };
    button.textContent = '✓ الصوت الطبيعي جاهز';
    status.textContent = 'تم تجهيز الصوت العربي الطبيعي. اضغط «اقرأ آخر شرح» للاستماع.';
  } catch (error) {
    console.error('Nabra load error:', error);
    const detail = String(error && (error.message || error.name) || error).slice(0, 150);
    status.textContent = 'تعذر التحميل: ' + detail + '. تأكد من اتصال الإنترنت ثم أعد المحاولة.';
    button.textContent = '↻ إعادة محاولة تحميل الصوت';
  } finally {
    loading = false;
    button.disabled = false;
  }
});
