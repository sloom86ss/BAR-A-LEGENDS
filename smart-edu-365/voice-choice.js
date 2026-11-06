// Adds an explicit choice between Nabra's single female MSA voice and device voices.
(() => {
  const panel = document.querySelector('.smart-voice-panel');
  const select = panel && panel.querySelector('select');
  if (!select) return;
  const key = 'smartEdu360VoiceURI';
  const saved = localStorage.getItem(key);
  const option = document.createElement('option');
  option.value = 'nabra-neural';
  option.textContent = 'نبرة — صوت فتاة عربية فصحى';
  select.insertBefore(option, select.firstChild);
  select.disabled = false;
  select.value = saved === 'nabra-neural' ? saved : 'nabra-neural';
  localStorage.setItem(key, select.value);
  const note = panel.querySelector('small');
  const nativeSpeak = window.SmartEduVoice && window.SmartEduVoice.speak;
  function say(text, rate = 0.88) {
    if (select.value === 'nabra-neural') {
      if (typeof window.SmartEduNabraSpeak !== 'function') {
        if (note) note.textContent = 'اضغط «تحميل الصوت العربي الطبيعي» أولاً لتجهيز صوت الفتاة.';
        return false;
      }
      window.SmartEduNabraSpeak(text).then(ok => {
        if (!ok && note) note.textContent = 'تعذر تشغيل الصوت الطبيعي. أعد تحميل النموذج أو اختر صوت الجهاز.';
      });
      return true;
    }
    const synth = window.speechSynthesis;
    if (!synth) return false;
    const voice = synth.getVoices().find(v => v.voiceURI === select.value);
    if (!voice) return false;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(String(text));
    utterance.voice = voice;
    utterance.lang = voice.lang;
    utterance.rate = rate;
    synth.speak(utterance);
    return true;
  }
  select.addEventListener('change', () => {
    localStorage.setItem(key, select.value);
    if (note) note.textContent = select.value === 'nabra-neural'
      ? 'اخترت صوت الفتاة العربية الفصحى. حمّل النموذج أولاً إذا لم يكن جاهزاً.'
      : 'تم اختيار صوت الجهاز.';
  });
  if (window.SmartEduVoice) window.SmartEduVoice.speak = say;
  const test = panel.querySelector('button');
  if (test) test.addEventListener('click', () => say('مَرْحَبًا يا بَطَل! أَنا مُعَلِّمَتُكَ الذَّكِيَّةُ. هَيَّا نَتَعَلَّمُ مَعًا.', 0.88));
})();