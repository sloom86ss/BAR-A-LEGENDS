// Nabra Arabic TTS: downloads the small ONNX voice model on first use and caches it in the browser.
const status = document.createElement('p');
status.className = 'note';
status.id = 'nabraStatus';
status.textContent = 'الصوت العربي الطبيعي اختياري؛ اضغط تحميله عند توفر اتصال بالإنترنت (نحو 16 ميجابايت أول مرة).';
const toolsRow = document.querySelector('.tools');
const button = document.createElement('button');
button.type = 'button';
button.className = 'btn gold';
button.id = 'nabraLoad';
button.textContent = '🎙️ تحميل الصوت العربي الطبيعي';
if (toolsRow) {
  toolsRow.appendChild(button);
  toolsRow.insertAdjacentElement('afterend', status);
}
let engine = null;
let loading = false;
button.addEventListener('click', async () => {
  if (loading) return;
  if (engine) {
    status.textContent = 'الصوت العربي الطبيعي جاهز. سيُستخدم عند الضغط على «اقرأ آخر شرح».';
    return;
  }
  loading = true;
  button.disabled = true;
  button.textContent = '⏳ جارٍ تحميل الصوت...';
  status.textContent = 'جارٍ تنزيل النموذج لأول مرة. أبقِ الصفحة مفتوحة واتصال الإنترنت مفعّلاً.';
  try {
    const { NabraTTS } = await import('https://cdn.jsdelivr.net/npm/nabra-tts@0/+esm');
    engine = await NabraTTS.load({
      dtype: 'fp16',
      device: 'auto',
      cache: true,
      onProgress: ({ file, loaded, total }) => {
        const pct = total ? Math.round(loaded / total * 100) : 0;
        status.textContent = 'تحميل النموذج: ' + pct + '% — ' + (file || 'ملفات الصوت');
      }
    });
    window.SmartEduNabraSpeak = async (text) => {
      try { await engine.speak(String(text)); return true; }
      catch (e) { console.error(e); return false; }
    };
    button.textContent = '✓ الصوت الطبيعي جاهز';
    status.textContent = 'تم تحميل الصوت وحفظ ملفاته مؤقتاً في ذاكرة المتصفح. يمكنك الآن تجربة القراءة.';
  } catch (error) {
    console.error(error);
    status.textContent = 'تعذر تحميل النموذج. تحقق من الإنترنت ثم أعد المحاولة؛ سيبقى الصوت الأساسي متاحاً.';
    button.textContent = '↻ إعادة محاولة تحميل الصوت';
  } finally {
    loading = false;
    button.disabled = false;
  }
});
