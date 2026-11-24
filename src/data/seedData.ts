import { HandoffRow, ShiftHeader, AlertThresholds, EMRRecord } from '../types/handoff';

export const DEFAULT_HEADER: ShiftHeader = {
  unit: 'Maple Neighborhood',
  date: new Date().toISOString().split('T')[0],
  shift: 'Day (07:00 - 15:00)',
  outgoingPsw: 'J. Santos, PSW',
  incomingPsw: 'M. Okafor, PSW',
};

export const DEFAULT_THRESHOLDS: AlertThresholds = {
  bowelMovementHoursThreshold: 48,
  fluidIntakeMinMl: 1000,
  weightChangeKgThreshold: 2.0,
  repositioningMaxHours: 2.0,
  silenceBufferSeconds: 0.8,
};

export const SEED_HANDOFF_ROWS: HandoffRow[] = [
  {
    room: '101',
    residentName: 'Mrs. A',
    done: { value: 'Per care plan' },
    notDoneNextShift: { value: '—' },
    changeCodes: { value: [] },
    changeNote: { value: 'No change' },
    toldNurse: { value: false },
    nurseInitials: { value: '' },
    mltcDetails: {
      weightKg: { value: 62.4 },
      fluidIntakeMl: { value: 1150 },
      bowelMovement: { value: '1 BM at 08:30 (formed)' },
      hoursSinceLastBM: { value: 6 },
      qualitativeObservations: { value: 'Calm morning. Participated in morning devotional. Ate 90% of breakfast and lunch.' },
      lastRepositionTime: { value: '13:30' },
    },
  },
  {
    room: '102',
    residentName: 'Mr. B',
    done: {
      value: 'Bath, breakfast, repositioned 09:00 and 11:30',
      sourceQuote: 'Did Mr. B bath and breakfast, repositioned him at 9 and 11:30.',
    },
    notDoneNextShift: {
      value: 'Refused lunch; offer snack around 15:30',
      sourceQuote: 'He refused his lunch today, so please offer him a snack around 15:30.',
    },
    changeCodes: {
      value: ['T_talks', 'A_ate'],
      sourceQuote: 'He was quieter than usual and only ate about half of breakfast.',
    },
    changeNote: {
      value: 'T (talks less), A (ate less): quieter than usual, ate about half of breakfast',
      sourceQuote: 'quieter than usual, ate about half of breakfast',
    },
    toldNurse: { value: true },
    nurseInitials: { value: 'RN (KL)' },
    mltcDetails: {
      weightKg: { value: 68.2 },
      fluidIntakeMl: { value: 650 },
      bowelMovement: { value: 'None this shift (last BM 52h ago)' },
      hoursSinceLastBM: { value: 52 },
      qualitativeObservations: { value: 'Appeared withdrawn, stayed in his recliner. Only finished juice and 50% porridge.' },
      lastRepositionTime: { value: '11:30' },
    },
    prevShiftTier: 2,
  },
  {
    room: '103',
    residentName: 'Mrs. C',
    done: {
      value: 'Breakfast, dressed, toileted 10:00',
      sourceQuote: 'Mrs. C got breakfast, dressed, and was toileted at 10.',
    },
    notDoneNextShift: {
      value: 'Bath moved to evening at her request',
      sourceQuote: 'She asked to move her scheduled bath to the evening shift instead.',
    },
    changeCodes: { value: [] },
    changeNote: { value: 'No change' },
    toldNurse: { value: false },
    nurseInitials: { value: '' },
    mltcDetails: {
      weightKg: { value: 55.1 },
      fluidIntakeMl: { value: 1250 },
      bowelMovement: { value: '1 BM at 10:15 (soft)' },
      hoursSinceLastBM: { value: 5 },
      qualitativeObservations: { value: 'Engaged and social during music recreation. Good appetite.' },
      lastRepositionTime: { value: '13:00' },
    },
  },
  {
    room: '104',
    residentName: 'Mr. D',
    done: {
      value: 'Breakfast, walk to activity room',
      sourceQuote: 'Finished breakfast and walked with Mr. D to the activity room.',
    },
    notDoneNextShift: {
      value: 'Nails not trimmed (ran out of time)',
      sourceQuote: 'His finger nails still need trimming, ran out of time before shift end.',
    },
    changeCodes: {
      value: ['H'],
      sourceQuote: 'Needed two people to transfer him at lunch today, usually only needs one person.',
    },
    changeNote: {
      value: 'H (help with walking/transfer): needed 2 people to transfer at lunch, usually 1',
      sourceQuote: 'needed 2 people to transfer at lunch, usually 1',
    },
    toldNurse: { value: false },
    nurseInitials: { value: '' },
    mltcDetails: {
      weightKg: { value: 74.0 },
      fluidIntakeMl: { value: 950 },
      bowelMovement: { value: '1 BM at 11:20' },
      hoursSinceLastBM: { value: 4 },
      qualitativeObservations: { value: 'Noticeable right-side leaning during lunch chair transfer. Noticed slight leg tremor.' },
      lastRepositionTime: { value: '12:45' },
    },
  },
  {
    room: '105',
    residentName: 'Mrs. E',
    done: { value: 'Per care plan' },
    notDoneNextShift: {
      value: 'Daughter visiting at 17:00, wants an update',
      sourceQuote: 'Her daughter called and will visit around 17:00, wants a quick update from evening staff.',
    },
    changeCodes: { value: [] },
    changeNote: { value: 'No change' },
    toldNurse: { value: false },
    nurseInitials: { value: '' },
    mltcDetails: {
      weightKg: { value: 60.5 },
      fluidIntakeMl: { value: 1300 },
      bowelMovement: { value: '1 BM at 07:45' },
      hoursSinceLastBM: { value: 7 },
      qualitativeObservations: { value: 'Cheerful mood, enjoyed reading magazine by window. Fluids well tolerated.' },
      lastRepositionTime: { value: '13:15' },
    },
  },
  {
    room: '106',
    residentName: 'Mr. F',
    done: {
      value: 'Bath, lunch, fluids encouraged',
      sourceQuote: 'Mr. F completed morning bath, finished lunch, encouraged fluids.',
    },
    notDoneNextShift: {
      value: 'Repositioning due 15:30',
      sourceQuote: 'Needs repositioning due at 15:30 to relieve pressure.',
    },
    changeCodes: {
      value: ['D', 'C'],
      sourceQuote: 'Drank much less than normal, and during skin check noticed a red area on left heel.',
    },
    changeNote: {
      value: 'D (drank less), C (skin change): drank less, red area on left heel',
      sourceQuote: 'drank less, red area on left heel',
    },
    toldNurse: { value: true },
    nurseInitials: { value: 'RN (KL)' },
    mltcDetails: {
      weightKg: { value: 71.8 },
      fluidIntakeMl: { value: 550 },
      bowelMovement: { value: 'None today (last BM 30h ago)' },
      hoursSinceLastBM: { value: 30 },
      qualitativeObservations: { value: 'Appeared lethargic post-lunch. Redness on heel does not blanch; nurse notified immediately.' },
      lastRepositionTime: { value: '13:30' },
    },
  },
];

export const SEED_ANYTHING_ELSE =
  'Lift battery in the tub room is low; spare is charging at the nursing station.';

export interface DemoScenario {
  id: string;
  title: string;
  language: string;
  languageName: string;
  description: string;
  rawTranscript: string;
  expectedTranslation: string;
  extractedChanges: {
    room: string;
    residentName: string;
    done: string;
    notDone: string;
    changeCodes: string[];
    changeNote: string;
    sourceQuote: string;
    weightKg?: number;
    fluidMl?: number;
    bowelMovement?: string;
    observations: string;
  }[];
  anythingElse: string;
}

export const DEMO_SCENARIOS: DemoScenario[] = [
  {
    id: 'tagalog_shift_handoff',
    title: 'Scenario A: Tagalog / Filipino Shift Report',
    language: 'fil-PH',
    languageName: 'Tagalog / Filipino',
    description: 'PSW J. Santos reporting on Rooms 102 (Mr. B), 104 (Mr. D), and 106 (Mr. F) with Stop & Watch signs.',
    rawTranscript: `Magandang hapon po. Handoff para sa Maple Neighborhood. Sa Room 102, si Mr. B, tapos na ang bath and breakfast, na-reposition ko siya ng 09:00 at 11:30. Pero tumanggi siya sa lunch ngayon, so paki-offer ng snack around 15:30. Napansin ko tahimik siya compared to usual, half lang kinain ng almusal, kaya Stop and Watch T at A po. Na-report ko na kay Nurse KL. Tapos sa Room 104, si Mr. D nakapag-lakad sa activity room, pero yung kuko niya hindi ko na-trim dahil kinulang sa oras. Sa transfer kaninang lunch, dalawang staff ang kinailangan kasi mahina ang kanan, normally isa lang, kaya Code H. Kay Mr. F naman sa 106, tapos ang bath at lunch, pero napansin ko may pamumula sa kaliwang sakong o left heel, at konti lang ininom niya, mga 550 mL lang buong shift. Repositioning due sa kanya ng 15:30. Nasabi ko na rin kay Nurse KL. At sa tub room po, low battery ang portable lift, yung spare nakakabit sa nursing station charger.`,
    expectedTranslation: `Good afternoon. Shift handoff for Maple Neighborhood. In Room 102, Mr. B finished his bath and breakfast, repositioned him at 09:00 and 11:30. But he refused lunch today, so please offer a snack around 15:30. Noticed he was quieter than usual, ate only half of breakfast, so Stop and Watch codes T and A. Already reported to Nurse KL. Then in Room 104, Mr. D walked to the activity room, but his nails were not trimmed due to running out of time. During the transfer at lunch, two staff were needed because of right-side weakness, normally just one, so Code H. For Mr. F in Room 106, finished bath and lunch, but noticed redness on his left heel, and he drank very little, only about 550 mL all shift. Repositioning due for him at 15:30. Already told Nurse KL. And in the tub room, the portable lift battery is low; the spare is charging at the nursing station.`,
    extractedChanges: [
      {
        room: '102',
        residentName: 'Mr. B',
        done: 'Bath, breakfast, repositioned 09:00 and 11:30',
        notDone: 'Refused lunch; offer snack around 15:30',
        changeCodes: ['T_talks', 'A_ate'],
        changeNote: 'T (talks less), A (ate less): quieter than usual, ate only half of breakfast',
        sourceQuote: 'tapos na ang bath and breakfast, na-reposition ko siya ng 09:00 at 11:30. Pero tumanggi siya sa lunch ngayon... tahimik siya compared to usual, half lang kinain',
        fluidMl: 650,
        bowelMovement: 'None logged this shift',
        observations: 'Noticeably quieter and withdrawn today. Refused lunch meal tray.',
      },
      {
        room: '104',
        residentName: 'Mr. D',
        done: 'Breakfast, walk to activity room',
        notDone: 'Nails not trimmed (ran out of time)',
        changeCodes: ['H'],
        changeNote: 'H (help with walking/transfer): needed 2 people to transfer at lunch, normally 1',
        sourceQuote: 'nakapag-lakad sa activity room, pero yung kuko niya hindi ko na-trim... transfer kaninang lunch, dalawang staff ang kinailangan kasi mahina ang kanan, normally isa lang',
        fluidMl: 950,
        bowelMovement: '1 BM at 11:20',
        observations: 'Required 2-person transfer for lunch due to right leg weakness.',
      },
      {
        room: '106',
        residentName: 'Mr. F',
        done: 'Bath, lunch, fluids encouraged',
        notDone: 'Repositioning due 15:30',
        changeCodes: ['D', 'C'],
        changeNote: 'D (drank less), C (skin change): drank less (550 mL), redness on left heel',
        sourceQuote: 'tapos ang bath at lunch, pero napansin ko may pamumula sa kaliwang sakong o left heel, at konti lang ininom niya, mga 550 mL lang... Repositioning due sa kanya ng 15:30',
        fluidMl: 550,
        bowelMovement: 'None logged',
        observations: 'Intake below threshold (550 mL). Stage 1 redness noted on left heel.',
      },
    ],
    anythingElse: 'Lift battery in the tub room is low; spare is charging at the nursing station.',
  },
  {
    id: 'punjabi_shift_handoff',
    title: 'Scenario B: Punjabi Shift Report',
    language: 'pa-IN',
    languageName: 'ਪੰਜਾਬੀ (Punjabi)',
    description: 'PSW reporting on Rooms 102 (Mr. B), 104 (Mr. D), and 106 (Mr. F) in Punjabi.',
    rawTranscript: `ਸਤਿ ਸ਼੍ਰੀ ਅਕਾਲ ਜੀ। ਮੈਪਲ ਨੇਬਰਹੁੱਡ ਸ਼ਿਫਟ ਹੈਂਡਓਵਰ। ਕਮਰਾ 102 ਵਿੱਚ ਮਿਸਟਰ ਬੀ ਦਾ ਨਾਸ਼ਤਾ ਅਤੇ ਬਾਥ ਪੂਰਾ ਹੋ ਗਿਆ, 09:00 ਅਤੇ 11:30 ਵਜੇ ਰੀਪੋਜ਼ੀਸ਼ਨ ਕੀਤਾ ਗਿਆ। ਉਹਨਾਂ ਨੇ ਦੁਪਹਿਰ ਦਾ ਖਾਣਾ ਮਨ੍ਹਾ ਕਰ ਦਿੱਤਾ, 15:30 ਵਜੇ ਸਨੈਕ ਦਿਓ। ਬਹੁਤ ਸ਼ਾਂਤ ਸਨ ਅਤੇ ਅੱਧਾ ਨਾਸ਼ਤਾ ਖਾਧਾ, ਕੋਡ ਟੀ ਅਤੇ ਏ। ਕਮਰਾ 104 ਵਿੱਚ ਮਿਸਟਰ ਡੀ ਨਾਸ਼ਤੇ ਤੋਂ ਬਾਅਦ ਐਕਟੀਵਿਟੀ ਰੂਮ ਵਿੱਚ ਚਲੇ ਗਏ, ਪਰ ਸਮੇਂ ਦੀ ਘਾਟ ਕਾਰਨ ਨਹੁੰ ਨਹੀਂ ਕੱਟੇ ਗਏ। ਦੁਪਹਿਰ ਨੂੰ ਟਰਾਂਸਫਰ ਲਈ ਦੋ ਲੋਕਾਂ ਦੀ ਲੋੜ ਪਈ ਕਿਉਂਕਿ ਸੱਜਾ ਪਾਸਾ ਕਮਜ਼ੋਰ ਸੀ, ਕੋਡ ਐਚ। ਕਮਰਾ 106 ਵਿੱਚ ਮਿਸਟਰ ਐਫ ਦਾ ਬਾਥ ਅਤੇ ਲੰਚ ਹੋ ਗਿਆ, ਪਰ ਖੱਬੀ ਅੱਡੀ ਤੇ ਲਾਲੀ ਦਿਸੀ ਅਤੇ ਸਿਰਫ 550 ਮਿ.ਲੀ. ਪਾਣੀ ਪੀਤਾ, ਕੋਡ ਡੀ ਅਤੇ ਸੀ। 15:30 ਵਜੇ ਰੀਪੋਜ਼ੀਸ਼ਨ ਕਰਨਾ ਹੈ। ਨਰਸ ਕੇਐਲ ਨੂੰ ਦੱਸ ਦਿੱਤਾ ਹੈ। ਟੱਬ ਰੂਮ ਵਿੱਚ ਲਿਫਟ ਦੀ ਬੈਟਰੀ ਘੱਟ ਹੈ, ਸਪੇਅਰ ਨਰਸਿੰਗ ਸਟੇਸ਼ਨ ਤੇ ਚਾਰਜ ਹੋ ਰਹੀ ਹੈ।`,
    expectedTranslation: `Sat Sri Akal. Maple Neighborhood shift handover. In Room 102, Mr. B completed his breakfast and bath, repositioned at 09:00 and 11:30. He refused lunch today, please offer a snack at 15:30. He was very quiet and ate half his breakfast, codes T and A. In Room 104, Mr. D went to the activity room after breakfast, but nails were not trimmed due to lack of time. At lunch transfer two people were needed due to right-side weakness, normally one person, code H. In Room 106, Mr. F had bath and lunch, but redness was observed on left heel and he only drank 550 mL, codes D and C. Repositioning due at 15:30. Reported to Nurse KL. Lift battery in tub room is low; spare is charging at the nursing station.`,
    extractedChanges: [
      {
        room: '102',
        residentName: 'Mr. B',
        done: 'Bath, breakfast, repositioned 09:00 and 11:30',
        notDone: 'Refused lunch; offer snack around 15:30',
        changeCodes: ['T_talks', 'A_ate'],
        changeNote: 'T (talks less), A (ate less): quiet, ate half breakfast, refused lunch',
        sourceQuote: 'ਕਮਰਾ 102 ਵਿੱਚ ਮਿਸਟਰ ਬੀ ਦਾ ਨਾਸ਼ਤਾ ਅਤੇ ਬਾਥ ਪੂਰਾ ਹੋ ਗਿਆ... ਦੁਪਹਿਰ ਦਾ ਖਾਣਾ ਮਨ੍ਹਾ ਕਰ ਦਿੱਤਾ... ਬਹੁਤ ਸ਼ਾਂਤ ਸਨ ਅਤੇ ਅੱਧਾ ਨਾਸ਼ਤਾ ਖਾਧਾ, ਕੋਡ ਟੀ ਅਤੇ ਏ',
        fluidMl: 650,
        bowelMovement: 'None logged this shift',
        observations: 'Noticeably withdrawn. Did not accept lunch meal tray.',
      },
      {
        room: '104',
        residentName: 'Mr. D',
        done: 'Breakfast, walk to activity room',
        notDone: 'Nails not trimmed (ran out of time)',
        changeCodes: ['H'],
        changeNote: 'H (help with walking/transfer): needed 2 people to transfer at lunch, normally 1',
        sourceQuote: 'ਕਮਰਾ 104 ਵਿੱਚ ਮਿਸਟਰ ਡੀ ਨਾਸ਼ਤੇ ਤੋਂ ਬਾਅਦ ਐਕਟੀਵਿਟੀ ਰੂਮ ਵਿੱਚ ਚਲੇ ਗਏ... ਨਹੁੰ ਨਹੀਂ ਕੱਟੇ ਗਏ... ਦੋ ਲੋਕਾਂ ਦੀ ਲੋੜ ਪਈ ਕਿਉਂਕਿ ਸੱਜਾ ਪਾਸਾ ਕਮਜ਼ੋਰ ਸੀ, ਕੋਡ ਐਚ',
        fluidMl: 950,
        bowelMovement: '1 BM at 11:20',
        observations: 'Right-sided weakness during transfer; assisted with 2-person pivot.',
      },
      {
        room: '106',
        residentName: 'Mr. F',
        done: 'Bath, lunch, fluids encouraged',
        notDone: 'Repositioning due 15:30',
        changeCodes: ['D', 'C'],
        changeNote: 'D (drank less), C (skin change): drank less (550 mL), redness on left heel',
        sourceQuote: 'ਕਮਰਾ 106 ਵਿੱਚ ਮਿਸਟਰ ਐਫ ਦਾ ਬਾਥ ਅਤੇ ਲੰਚ ਹੋ ਗਿਆ, ਪਰ ਖੱਬੀ ਅੱਡੀ ਤੇ ਲਾਲੀ ਦਿਸੀ ਅਤੇ ਸਿਰਫ 550 ਮਿ.ਲੀ. ਪਾਣੀ ਪੀਤਾ, ਕੋਡ ਡੀ ਅਤੇ ਸੀ',
        fluidMl: 550,
        bowelMovement: 'None logged',
        observations: 'Low fluid intake (550 mL). Red patch on left heel.',
      },
    ],
    anythingElse: 'Lift battery in the tub room is low; spare is charging at the nursing station.',
  },
  {
    id: 'hindi_shift_handoff',
    title: 'Scenario C: Hindi Shift Report',
    language: 'hi-IN',
    languageName: 'हिन्दी (Hindi)',
    description: 'PSW reporting on Rooms 102 (Mr. B), 104 (Mr. D), and 106 (Mr. F) in Hindi.',
    rawTranscript: `नमस्ते। मेपल नेबरहुड शिफ्ट हैंडऑफ रिपोर्ट। रूम 102 में मिस्टर बी का बाथ और ब्रेकफास्ट पूरा हो गया, 09:00 और 11:30 बजे रिपोजिशन किया गया। लेकिन उन्होंने लंच खाने से मना कर दिया, कृपया 15:30 पर स्नैक दें। वह सामान्य से अधिक शांत थे और नाश्ता आधा खाया, इसलिए कोड टी और ए। रूम 104 में मिस्टर डी ब्रेकफास्ट के बाद एक्टिविटी रूम गए, लेकिन समय की कमी से नाखून नहीं कट सके। लंच ट्रांसफर के समय 2 स्टाफ की जरूरत पड़ी क्योंकि दाहिना पैर कमजोर था, सामान्यतः 1 व्यक्ति, इसलिए कोड एच। रूम 106 में मिस्टर एफ का बाथ और लंच हो गया, लेकिन बाएं एड़ी पर लाल निशान दिखा और पूरे शिफ्ट में सिर्फ 550 मिली पानी पिया, कोड डी और सी। 15:30 पर रिपोजिशन करना है। नर्स केएल को बता दिया है। टब रूम लिफ्ट की बैटरी कम है, स्पेयर नर्सिंग स्टेशन पर चार्ज हो रही है।`,
    expectedTranslation: `Hello. Maple Neighborhood shift handoff report. In Room 102, Mr. B finished bath and breakfast, repositioned at 09:00 and 11:30. But he refused lunch, please offer a snack at 15:30. He was quieter than normal and ate half of breakfast, so codes T and A. In Room 104, Mr. D went to activity room after breakfast, but nails were not trimmed due to lack of time. At lunch transfer 2 staff were required because right leg was weak, normally 1 person, so Code H. In Room 106, Mr. F finished bath and lunch, but red mark was seen on left heel and he drank only 550 mL fluids all shift, codes D and C. Repositioning due at 15:30. Told Nurse KL. Tub room lift battery is low, spare is charging at nursing station.`,
    extractedChanges: [
      {
        room: '102',
        residentName: 'Mr. B',
        done: 'Bath, breakfast, repositioned 09:00 and 11:30',
        notDone: 'Refused lunch; offer snack around 15:30',
        changeCodes: ['T_talks', 'A_ate'],
        changeNote: 'T (talks less), A (ate less): quieter than usual, ate half of breakfast, refused lunch',
        sourceQuote: 'रूम 102 में मिस्टर बी का बाथ और ब्रेकफास्ट पूरा हो गया... लंच खाने से मना कर दिया... शांत थे और नाश्ता आधा खाया, इसलिए कोड टी और ए',
        fluidMl: 650,
        bowelMovement: 'None logged this shift',
        observations: 'Unusually quiet demeanor. Refused lunch tray.',
      },
      {
        room: '104',
        residentName: 'Mr. D',
        done: 'Breakfast, walk to activity room',
        notDone: 'Nails not trimmed (ran out of time)',
        changeCodes: ['H'],
        changeNote: 'H (help with walking/transfer): needed 2 people to transfer at lunch, normally 1',
        sourceQuote: 'रूम 104 में मिस्टर डी ब्रेकफास्ट के बाद एक्टिविटी रूम गए, लेकिन समय की कमी से नाखून नहीं कट सके। लंच ट्रांसफर के समय 2 स्टाफ की जरूरत पड़ी... कोड एच',
        fluidMl: 950,
        bowelMovement: '1 BM at 11:20',
        observations: 'Right-side weakness required 2-person transfer for lunch.',
      },
      {
        room: '106',
        residentName: 'Mr. F',
        done: 'Bath, lunch, fluids encouraged',
        notDone: 'Repositioning due 15:30',
        changeCodes: ['D', 'C'],
        changeNote: 'D (drank less), C (skin change): red mark on left heel, drank 550 mL fluids',
        sourceQuote: 'रूम 106 में मिस्टर एफ का बाथ और लंच हो गया, लेकिन बाएं एड़ी पर लाल निशान दिखा और पूरे शिफ्ट में सिर्फ 550 मिली पानी पिया, कोड डी और सी',
        fluidMl: 550,
        bowelMovement: 'None logged',
        observations: 'Stage 1 redness noted on left heel. Low fluid intake (550 mL).',
      },
    ],
    anythingElse: 'Lift battery in the tub room is low; spare is charging at the nursing station.',
  },
  {
    id: 'spanish_shift_handoff',
    title: 'Scenario D: Spanish Shift Report',
    language: 'es-ES',
    languageName: 'Español (Spanish)',
    description: 'PSW reporting on Rooms 102 (Mr. B), 104 (Mr. D), and 106 (Mr. F) in Spanish.',
    rawTranscript: `Buenas tardes. Reporte de cambio de turno para Maple Neighborhood. En la habitación 102, el Sr. B completó baño y desayuno, reposicionado a las 09:00 y 11:30. Pero rechazó el almuerzo, por favor ofrecerle un refrigerio a las 15:30. Estuvo más callado de lo habitual y comió solo la mitad del desayuno, códigos T y A. En la habitación 104, el Sr. D desayunó y caminó a la sala de actividades, pero sus uñas no fueron cortadas por falta de tiempo. En la transferencia del almuerzo se necesitaron 2 personas por debilidad en el lado derecho, normalmente una, código H. En la habitación 106, el Sr. F completó baño y almuerzo, pero notamos una zona enrojecida en el talón izquierdo y bebió muy poco, solo 550 mL en todo el turno, códigos D y C. Reposicionamiento a las 15:30. Ya informé a la enfermera KL. En el cuarto de baño la batería de la grúa está baja; el repuesto está cargando en la estación de enfermería.`,
    expectedTranslation: `Good afternoon. Shift change report for Maple Neighborhood. In Room 102, Mr. B completed bath and breakfast, repositioned at 09:00 and 11:30. But he rejected lunch, please offer him a snack at 15:30. He was quieter than usual and ate only half of breakfast, codes T and A. In Room 104, Mr. D had breakfast and walked to the activity room, but his nails were not trimmed due to lack of time. In the lunch transfer 2 staff were needed due to weakness on the right side, normally one, code H. In Room 106, Mr. F completed bath and lunch, but we noticed a reddened area on left heel and he drank very little, only 550 mL all shift, codes D and C. Repositioning due at 15:30. Already informed Nurse KL. In the tub room the lift battery is low; spare is charging at the nursing station.`,
    extractedChanges: [
      {
        room: '102',
        residentName: 'Mr. B',
        done: 'Bath, breakfast, repositioned 09:00 and 11:30',
        notDone: 'Refused lunch; offer snack around 15:30',
        changeCodes: ['T_talks', 'A_ate'],
        changeNote: 'T (talks less), A (ate less): quieter than usual, ate half of breakfast, refused lunch',
        sourceQuote: 'habitación 102, el Sr. B completó baño y desayuno... rechazó el almuerzo... más callado de lo habitual y comió solo la mitad del desayuno, códigos T y A',
        fluidMl: 650,
        bowelMovement: 'None logged this shift',
        observations: 'Quiet and withdrawn today. Did not eat lunch tray.',
      },
      {
        room: '104',
        residentName: 'Mr. D',
        done: 'Breakfast, walk to activity room',
        notDone: 'Nails not trimmed (ran out of time)',
        changeCodes: ['H'],
        changeNote: 'H (help with walking/transfer): needed 2 people to transfer at lunch, normally 1',
        sourceQuote: 'habitación 104, el Sr. D desayunó y caminó a la sala de actividades, pero sus uñas no fueron cortadas... transferencia del almuerzo se necesitaron 2 personas... código H',
        fluidMl: 950,
        bowelMovement: '1 BM at 11:20',
        observations: 'Right-sided weakness during transfer. Assisted with 2-person pivot.',
      },
      {
        room: '106',
        residentName: 'Mr. F',
        done: 'Bath, lunch, fluids encouraged',
        notDone: 'Repositioning due 15:30',
        changeCodes: ['D', 'C'],
        changeNote: 'D (drank less), C (skin change): red area on left heel, 550 mL fluids',
        sourceQuote: 'habitación 106, el Sr. F completó baño y almuerzo, pero notamos una zona enrojecida en el talón izquierdo y bebió muy poco, solo 550 mL... códigos D y C',
        fluidMl: 550,
        bowelMovement: 'None logged',
        observations: 'Low fluid intake (550 mL). Red patch on left heel.',
      },
    ],
    anythingElse: 'Lift battery in the tub room is low; spare is charging at the nursing station.',
  },
];

export const INITIAL_EMR_HISTORY: EMRRecord[] = [
  {
    id: 'emr-prev-shift-01',
    submittedAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
    header: {
      unit: 'Maple Neighborhood',
      date: new Date(Date.now() - 24 * 3600 * 1000).toISOString().split('T')[0],
      shift: 'Day (07:00 - 15:00)',
      outgoingPsw: 'P. Chen, PSW',
      incomingPsw: 'J. Santos, PSW',
    },
    rows: SEED_HANDOFF_ROWS,
    anythingElse: 'Tub room scale calibrated this morning by maintenance.',
    escalations: [
      {
        id: 'esc-prev-1',
        room: '102',
        residentName: 'Mr. B',
        codes: ['T_talks'],
        note: 'Quiet throughout morning coffee circle',
        timestamp: '11:15',
        outgoingPsw: 'P. Chen, PSW',
        status: 'acknowledged',
        acknowledgedBy: 'Nurse KL, RN',
        acknowledgedAt: '11:35',
        nurseComment: 'Checked vitals, BP 124/78, Temp 36.8C. Will monitor intake.',
      },
    ],
    rawTranscript: 'Mr. B was quiet during morning group, took 1000 mL water. Mrs. A and C per care plan.',
    auditTrail: [
      {
        timestamp: new Date(Date.now() - 24 * 3600 * 1000).toLocaleTimeString(),
        actor: 'P. Chen, PSW',
        role: 'Outgoing PSW',
        action: 'Confirmed & Submitted Handoff',
        details: 'Verified all 6 residents, logged 1 nurse escalation for Room 102.',
      },
      {
        timestamp: new Date(Date.now() - 24 * 3600 * 1000 + 1200000).toLocaleTimeString(),
        actor: 'K. Lewis, RN',
        role: 'Charge Nurse',
        action: 'Acknowledged Escalation',
        details: 'Acknowledged Stop & Watch observation for Room 102.',
      },
    ],
    submittedBy: 'P. Chen, PSW',
    acknowledgedByNurse: 'K. Lewis, RN',
  },
];
