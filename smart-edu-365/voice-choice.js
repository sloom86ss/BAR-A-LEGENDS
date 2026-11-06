// Adds a selectable female Arabic MSA neural voice alongside device voices.
(() => {
  const panel = document.querySelector('.smart-voice-panel');
  const select = panel && panel.querySelector('select');
  if (!select) return;
  const voiceKey = 'smartEdu360VoiceURI';
  const modeKey = 'smartEdu360VoiceMode';
  const note = panel.querySelector('small');
  let mode = localStorage.getItem(modeKey) || 'nabra-neural';

  function ensureNeuralOption() {
    if (!Array.from(select.options).some(o => o.value === 'nabra-neural')) {
      const option = document.createElement('option');
      option.value = 'nabra-neural';
      option.textContent = 'نبرة — صوت فتاة عربية فصحى';
      select.insertBefore(option, select.firstChild);
    }
    select.disabled = false;
  }
  function restoreChoice() {
    ensureNeuralOption();
    if (mode === 'nabra-neural') select.value = 'nabra-neural';
    else {
      const savedVoice = localStorage.getItem(voiceKey);
      if (savedVoice && Array.from(select.options).some(o => o.value === savedVoice)) select.value = savedVoice;
      else select.value = 'nabra-neural';
    }
    updateNote();
  }
  function updateNote() {
    if (!note) return;
    if (select.value === 'nabra-neural') {
      note.textContent = window.SmartEduNabraSpeak
        ? 'صوت الفتاة العربية الفصحى جاهز.'
        : 'اخترت صوت الفتاة العربية الفصحى؛ اضغط «تحميل الصوت العربي الطبيعي» لتجهيزه أول مرة.';
    } else note.textContent = 'تم اختيار صوت عربي من جهازك.';
  }
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
    mode = select.value === 'nabra-neural' ? 'nabra-neural' : 'device';
    localStorage.setItem(modeKey, mode);
    if (mode === 'device') localStorage.setItem(voiceKey, select.value);
    updateNote();
  });
  if (window.SmartEduVoice) window.SmartEduVoice.speak = say;
  const oldTest = panel.querySelector('button');
  if (oldTest) {
    const test = oldTest.cloneNode(true);
    oldTest.replaceWith(test);
    test.addEventListener('click', () => say('مَرْحَبًا يا بَطَل! أَنا مُعَلِّمَتُكَ الذَّكِيَّةُ. هَيَّا نَتَعَلَّمُ مَعًا.', 0.88));
  }
  restoreChoice();
  if (window.speechSynthesis) {
    window.speechSynthesis.addEventListener('voiceschanged', () => {
      restoreChoice();
      if (window.SmartEduVoice) window.SmartEduVoice.speak = say;
    });
  }
})();