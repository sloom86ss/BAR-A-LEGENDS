# SMART AI 365 — Multilingual acceptance tests

Use this checklist before public launch. These are manual/automatable test prompts, not claimed results.

## Language coverage
For each prompt, verify:
1. The answer is in the same language and script as the prompt.
2. The answer addresses the actual question accurately.
3. It does not switch languages unnecessarily.
4. It admits uncertainty rather than fabricating facts.
5. RTL layout remains readable for Arabic, Persian and Urdu.

| Language | Test prompt | Expected behavior |
|---|---|---|
| Arabic | اشرح الفرق بين الطاقة والقدرة بمثال بسيط. | Answer in clear Arabic. |
| English | Explain the difference between energy and power with a simple example. | Answer in English. |
| Hindi | ऊर्जा और शक्ति के बीच अंतर एक सरल उदाहरण से समझाइए। | Answer in Hindi, Devanagari script. |
| Urdu | توانائی اور طاقت میں فرق ایک آسان مثال سے سمجھائیں۔ | Answer in Urdu, right-to-left. |
| French | Expliquez la différence entre l'énergie et la puissance avec un exemple simple. | Answer in French. |
| Spanish | Explica la diferencia entre energía y potencia con un ejemplo sencillo. | Answer in Spanish. |
| German | Erkläre den Unterschied zwischen Energie und Leistung anhand eines einfachen Beispiels. | Answer in German. |
| Chinese (Simplified) | 请用一个简单的例子解释能量和功率的区别。 | Answer in Simplified Chinese. |
| Japanese | エネルギーと電力の違いを簡単な例で説明してください。 | Answer in Japanese. |
| Korean | 에너지와 전력의 차이를 간단한 예로 설명해 주세요. | Answer in Korean. |
| Portuguese | Explique a diferença entre energia e potência com um exemplo simples. | Answer in Portuguese. |
| Russian | Объясните разницу между энергией и мощностью на простом примере. | Answer in Russian. |
| Bengali | একটি সহজ উদাহরণ দিয়ে শক্তি ও ক্ষমতার পার্থক্য ব্যাখ্যা করুন। | Answer in Bengali. |
| Indonesian | Jelaskan perbedaan energi dan daya dengan contoh sederhana. | Answer in Indonesian. |
| Turkish | Enerji ve güç arasındaki farkı basit bir örnekle açıklayın. | Answer in Turkish. |

## Cross-language and task tests
- Ask in Arabic to translate a short paragraph into Hindi; verify the target language.
- Ask in English for a short Python function and tests; run the code in a separate test environment.
- Ask in Spanish for a summary of a supplied paragraph; check that no facts were added.
- Ask a calculation with a known answer in Hindi and Arabic; compare to a verified result.
- Continue a conversation by referring to an earlier detail; verify context is preserved.
- Ask a question whose answer is unknown or time-sensitive; verify the model states its limitation.

## Scoring
Record each test as pass/fail with reviewer notes. Report results separately by language and task. Do not combine them into a single percentage that hides weak languages. The 98% target applies only to a defined, reviewed test set; it is not a universal accuracy guarantee.

## Important limitation
Qwen3/Ollama model language coverage and quality depend on the selected model size, quantization, hardware and prompt. Test the exact deployed model. Add native-speaker review for languages where correctness matters.
