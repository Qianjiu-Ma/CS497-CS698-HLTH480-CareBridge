export interface LanguageInfo {
  code: string;
  speechCode: string;
  name: string;
  nativeName: string;
  flag?: string;
  dir?: 'ltr' | 'rtl';
}

export const TOP_LANGUAGES: LanguageInfo[] = [
  { code: 'en', speechCode: 'en-CA', name: 'English', nativeName: 'English (Canada)', flag: '🇨🇦' },
  { code: 'tl', speechCode: 'fil-PH', name: 'Tagalog', nativeName: 'Tagalog / Filipino', flag: '🇵🇭' },
  { code: 'es', speechCode: 'es-ES', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
  { code: 'pa', speechCode: 'pa-IN', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ (Punjabi)', flag: '🇮🇳' },
  { code: 'hi', speechCode: 'hi-IN', name: 'Hindi', nativeName: 'हिन्दी (Hindi)', flag: '🇮🇳' },
  { code: 'fr', speechCode: 'fr-CA', name: 'French', nativeName: 'Français (Canada)', flag: '🇨🇦' },
  { code: 'zh', speechCode: 'zh-CN', name: 'Mandarin', nativeName: '普通话 (Mandarin)', flag: '🇨🇳' },
  { code: 'ar', speechCode: 'ar-SA', name: 'Arabic', nativeName: 'العربية (Arabic)', flag: '🇸🇦', dir: 'rtl' },
];

export const ALL_LANGUAGES: LanguageInfo[] = [
  ...TOP_LANGUAGES,
  { code: 'yue', speechCode: 'zh-HK', name: 'Cantonese', nativeName: '粵語 (Hong Kong)', flag: '🇭🇰' },
  { code: 'vi', speechCode: 'vi-VN', name: 'Vietnamese', nativeName: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'pt', speechCode: 'pt-BR', name: 'Portuguese', nativeName: 'Português', flag: '🇵🇹' },
  { code: 'it', speechCode: 'it-IT', name: 'Italian', nativeName: 'Italiano', flag: '🇮🇹' },
  { code: 'pl', speechCode: 'pl-PL', name: 'Polish', nativeName: 'Polski', flag: '🇵🇱' },
  { code: 'uk', speechCode: 'uk-UA', name: 'Ukrainian', nativeName: 'Українська', flag: '🇺🇦' },
  { code: 'de', speechCode: 'de-DE', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
  { code: 'ur', speechCode: 'ur-PK', name: 'Urdu', nativeName: 'اردو (Urdu)', flag: '🇵🇰', dir: 'rtl' },
  { code: 'gu', speechCode: 'gu-IN', name: 'Gujarati', nativeName: 'ગુજરાતી (Gujarati)', flag: '🇮🇳' },
  { code: 'ta', speechCode: 'ta-IN', name: 'Tamil', nativeName: 'தமிழ் (Tamil)', flag: '🇮🇳' },
  { code: 'ko', speechCode: 'ko-KR', name: 'Korean', nativeName: '한국어 (Korean)', flag: '🇰🇷' },
  { code: 'ja', speechCode: 'ja-JP', name: 'Japanese', nativeName: '日本語 (Japanese)', flag: '🇯🇵' },
  { code: 'ru', speechCode: 'ru-RU', name: 'Russian', nativeName: 'Русский', flag: '🇷🇺' },
  { code: 'el', speechCode: 'el-GR', name: 'Greek', nativeName: 'Ελληνικά', flag: '🇬🇷' },
];

export interface PhrasebookItem {
  id: string;
  category: 'nutrition' | 'mobility' | 'skin_vitals' | 'cognition' | 'logistics' | 'routine';
  categoryLabel: string;
  english: string;
  translations: Record<string, string>;
  stopAndWatchCode?: string;
  clinicalNote?: string;
}

export const LTC_PHRASEBOOK: PhrasebookItem[] = [
  // Nutrition & Hydration
  {
    id: 'ph-nut-1',
    category: 'nutrition',
    categoryLabel: 'Nutrition & Meals',
    english: 'Refused lunch; offer snack around 15:30',
    translations: {
      tl: 'Tumanggi sa tanghalian; mag-alok ng meryenda bandang 15:30',
      es: 'Rechazó el almuerzo; ofrecer refrigerio alrededor de las 15:30',
      pa: 'ਦੁਪਹਿਰ ਦਾ ਖਾਣਾ ਮਨ੍ਹਾ ਕੀਤਾ; ਲਗਭਗ 15:30 ਵਜੇ ਸਨੈਕ ਦਿਓ',
      hi: 'दोपहर का भोजन करने से मना कर दिया; लगभग 15:30 बजे स्नैक दें',
      fr: 'A refusé le dîner; offrir une collation vers 15:30',
      zh: '拒绝用午餐；请在 15:30 左右提供点心',
      ar: 'رفض تناول وجبة الغداء؛ يرجى تقديم وجبة خفيفة حوالي الساعة 15:30',
    },
    stopAndWatchCode: 'A_ate',
    clinicalNote: 'Stop & Watch Code A (Ate less than usual)',
  },
  {
    id: 'ph-nut-2',
    category: 'nutrition',
    categoryLabel: 'Nutrition & Meals',
    english: 'Ate about half of breakfast, seemed less interested in food',
    translations: {
      tl: 'Halos kalahati lang ng almusal ang kinain, parang walang ganang kumain',
      es: 'Comió aproximadamente la mitad del desayuno, parecía menos interesado en la comida',
      pa: 'ਨਾਸ਼ਤੇ ਦਾ ਲਗਭਗ ਅੱਧਾ ਹਿੱਸਾ ਖਾਧਾ, ਖਾਣੇ ਵਿੱਚ ਘੱਟ ਦਿਲਚਸਪੀ ਦਿਖਾਈ',
      hi: 'नाश्ते का लगभग आधा हिस्सा खाया, भोजन में कम रुचि दिखाई',
      fr: 'A mangé environ la moitié du déjeuner, semblait moins intéressé par la nourriture',
      zh: '只吃了一半早餐，对食物似乎不太感兴趣',
      ar: 'أكل حوالي نصف وجبة الإفطار وبدا أقل رغبة في الطعام',
    },
    stopAndWatchCode: 'A_ate',
  },
  {
    id: 'ph-nut-3',
    category: 'nutrition',
    categoryLabel: 'Nutrition & Meals',
    english: 'Drank very little today, only about 550 mL all shift; fluids encouraged',
    translations: {
      tl: 'Konti lang ininom niya ngayong araw, mga 550 mL lang buong shift; hinikayat uminom ng likido',
      es: 'Tomó muy pocos líquidos hoy, solo unos 550 mL en todo el turno; se motivó la hidratación',
      pa: 'ਅੱਜ ਬਹੁਤ ਘੱਟ ਪਾਣੀ ਪੀਤਾ, ਪੂਰੀ ਸ਼ਿਫਟ ਵਿੱਚ ਸਿਰਫ਼ 550 ਮਿਲੀਲੀਟਰ; ਤਰਲ ਪਦਾਰਥ ਪੀਣ ਲਈ ਉਤਸ਼ਾਹਿਤ ਕੀਤਾ',
      hi: 'आज बहुत कम पानी पिया, पूरी शिफ्ट में सिर्फ 550 एमएल; तरल पदार्थ लेने के लिए प्रेरित किया',
      fr: 'A bu très peu aujourd’hui, seulement environ 550 mL sur tout le quart; liquides encouragés',
      zh: '今天液体摄入很少，整个班次仅约 550 毫升；已鼓励多饮水',
      ar: 'شرب القليل جداً اليوم، حوالي 550 مل فقط طوال المناوبة؛ تم تشجيعه على شرب السوائل',
    },
    stopAndWatchCode: 'D',
    clinicalNote: 'Stop & Watch Code D (Drank less than usual - dehydration risk)',
  },

  // Mobility & Transfers
  {
    id: 'ph-mob-1',
    category: 'mobility',
    categoryLabel: 'Mobility & Transfers',
    english: 'Needed 2 people to transfer at lunch, usually 1 person; right side weaker',
    translations: {
      tl: 'Kinailangan ng 2 tao para sa paglipat noong tanghalian, karaniwan ay 1 lang; mahina ang kanang bahagi',
      es: 'Necesitó 2 personas para transferir en el almuerzo, usualmente 1 persona; lado derecho más débil',
      pa: 'ਦੁਪਹਿਰ ਦੇ ਖਾਣੇ ਸਮੇਂ ਟਰਾਂਸਫਰ ਲਈ 2 ਲੋਕਾਂ ਦੀ ਲੋੜ ਪਈ, ਆਮ ਤੌਰ ਤੇ 1 ਵਿਅਕਤੀ; ਸੱਜਾ ਪਾਸਾ ਕਮਜ਼ੋਰ ਹੈ',
      hi: 'दोपहर के भोजन के समय ट्रांसफर के लिए 2 लोगों की आवश्यकता पड़ी, आमतौर पर 1 व्यक्ति; दायां हिस्सा कमजोर',
      fr: 'A eu besoin de 2 personnes pour le transfert au dîner, habituellement 1; côté droit plus faible',
      zh: '午餐转移时需要 2 人协助，平时只需 1 人；右侧身体偏弱',
      ar: 'احتاج إلى شخصين للمساعدة في النقل أثناء الغداء، عادة شخص واحد؛ الجانب الأيمن أضعف',
    },
    stopAndWatchCode: 'H',
    clinicalNote: 'Stop & Watch Code H (Help needed with walking/transferring)',
  },
  {
    id: 'ph-mob-2',
    category: 'mobility',
    categoryLabel: 'Mobility & Transfers',
    english: 'Repositioning due at 15:30; please check pressure points',
    translations: {
      tl: 'Nakatakdang i-reposition sa 15:30; paki-tingnan ang mga pressure point',
      es: 'Toca reposicionamiento a las 15:30; por favor revise los puntos de presión',
      pa: '15:30 ਵਜੇ ਪੁਜ਼ੀਸ਼ਨ ਬਦਲਣੀ ਬਾਕੀ ਹੈ; ਕਿਰਪਾ ਕਰਕੇ ਪ੍ਰੈਸ਼ਰ ਪੁਆਇੰਟਾਂ ਦੀ ਜਾਂਚ ਕਰੋ',
      hi: '15:30 बजे करवट बदलना बाकी है; कृपया दबाव बिंदुओं की जांच करें',
      fr: 'Repositionnement prévu à 15:30; vérifier les points de pression s’il vous plaît',
      zh: '预计于 15:30 翻身复位；请检查受压部位',
      ar: 'موعد تغيير الوضعية عند 15:30؛ يرجى فحص نقاط الضغط',
    },
  },

  // Skin & Vitals
  {
    id: 'ph-skin-1',
    category: 'skin_vitals',
    categoryLabel: 'Skin & Vitals',
    english: 'During skin check noticed a red area on left heel; told charge nurse',
    translations: {
      tl: 'Sa pagsusuri ng balat napansin ang namumulang bahagi sa kaliwang sakong; sinabi sa charge nurse',
      es: 'Durante la revisión de piel notamos una zona enrojecida en el talón izquierdo; informamos a la enfermera a cargo',
      pa: 'ਚਮੜੀ ਦੀ ਜਾਂਚ ਦੌਰਾਨ ਖੱਬੀ ਅੱਡੀ ਤੇ ਲਾਲ ਨਿਸ਼ਾਨ ਦੇਖਿਆ; ਇੰਚਾਰਜ ਨਰਸ ਨੂੰ ਦੱਸ ਦਿੱਤਾ ਹੈ',
      hi: 'त्वचा की जांच के दौरान बाईं एड़ी पर लाल क्षेत्र देखा; चार्ज नर्स को सूचित किया',
      fr: 'Pendant le contrôle cutané, remarqué une zone rouge au talon gauche; infirmière responsable prévenue',
      zh: '皮肤检查时发现左脚后跟有一块发红区域；已汇报给主管护士',
      ar: 'أثناء فحص الجلد لوحظ احمرار في الكعب الأيسر؛ تم إبلاغ الممرضة المسؤولة',
    },
    stopAndWatchCode: 'C',
    clinicalNote: 'Stop & Watch Code C (Change in skin condition)',
  },
  {
    id: 'ph-skin-2',
    category: 'skin_vitals',
    categoryLabel: 'Skin & Vitals',
    english: 'Complained of lower back discomfort when sitting up; offered pillow support',
    translations: {
      tl: 'Dumaing ng pananakit ng ibabang likod nang umupo; binigyan ng suportang unan',
      es: 'Se quejó de molestia en la parte baja de la espalda al sentarse; se le ofreció almohada de apoyo',
      pa: 'ਬੈਠਣ ਸਮੇਂ ਕਮਰ ਦੇ ਹੇਠਲੇ ਹਿੱਸੇ ਵਿੱਚ ਦਰਦ ਦੀ ਸ਼ਿਕਾਇਤ ਕੀਤੀ; ਸਹਾਰੇ ਲਈ ਸਿਰਹਾਣਾ ਦਿੱਤਾ ਗਿਆ',
      hi: 'बैठते समय पीठ के निचले हिस्से में दर्द की शिकायत की; तकिए का सहारा दिया',
      fr: 'S’est plaint d’un inconfort au bas du dos en position assise; soutien avec oreiller offert',
      zh: '坐起时主诉下背部不适；已提供枕头支撑',
      ar: 'اشتكى من عدم راحة في أسفل الظهر عند الجلوس؛ تم وضع وسادة للدعم',
    },
    stopAndWatchCode: 'P',
    clinicalNote: 'Stop & Watch Code P (Pain - new or worsening)',
  },

  // Cognition & Mood
  {
    id: 'ph-cog-1',
    category: 'cognition',
    categoryLabel: 'Cognition & Behavior',
    english: 'Noticed resident was quieter than usual, less verbal during morning care',
    translations: {
      tl: 'Napansin na mas tahimik ang resident kaysa karaniwan, hindi masyadong nagsasalita sa morning care',
      es: 'Se notó al residente más callado de lo habitual, menos comunicativo durante los cuidados matutinos',
      pa: 'ਨਿਵਾਸੀ ਆਮ ਨਾਲੋਂ ਜ਼ਿਆਦਾ ਸ਼ਾਂਤ ਦਿਖਾਈ ਦਿੱਤਾ, ਸਵੇਰ ਦੀ ਦੇਖਭਾਲ ਦੌਰਾਨ ਘੱਟ ਗੱਲ ਕੀਤੀ',
      hi: 'निवासी सामान्य से अधिक शांत दिखे, सुबह की देखभाल के दौरान कम बोले',
      fr: 'Résident plus silencieux que d’habitude, moins verbal durant les soins du matin',
      zh: '注意到住户比平时安静，早间护理期间话较少',
      ar: 'لوحظ أن المقيم أهدأ من المعتاد، وأقل حديثاً أثناء رعاية الصباح',
    },
    stopAndWatchCode: 'T_talks',
    clinicalNote: 'Stop & Watch Code T (Talks less than usual)',
  },

  // Logistics & Care Plan
  {
    id: 'ph-log-1',
    category: 'logistics',
    categoryLabel: 'Shift Logistics',
    english: 'Lift battery in tub room is low; spare battery is charging at nursing station',
    translations: {
      tl: 'Mababa ang baterya ng lift sa tub room; ang reserba ay nakakabit sa charger sa nursing station',
      es: 'La batería de la grúa en la sala de baño está baja; la de repuesto está cargando en la estación de enfermería',
      pa: 'ਟੱਬ ਰੂਮ ਵਿੱਚ ਲਿਫਟ ਦੀ ਬੈਟਰੀ ਘੱਟ ਹੈ; ਵਾਧੂ ਬੈਟਰੀ ਨਰਸਿੰਗ ਸਟੇਸ਼ਨ ਤੇ ਚਾਰਜ ਹੋ ਰਹੀ ਹੈ',
      hi: 'टब रूम में लिफ्ट की बैटरी कम है; अतिरिक्त बैटरी नर्सिंग स्टेशन पर चार्ज हो रही है',
      fr: 'La batterie du lève-personne dans la salle de bain est faible; batterie de rechange en charge au poste',
      zh: '浴室升降机电池电量不足；备用电池正在护士站充电',
      ar: 'بطارية الرافعة في غرفة الاستحمام منخفضة؛ البطارية الاحتياطية قيد الشحن في محطة التمريض',
    },
  },
  {
    id: 'ph-log-2',
    category: 'logistics',
    categoryLabel: 'Shift Logistics',
    english: 'Daughter visiting at 17:00, wants an update on today’s care and appetite',
    translations: {
      tl: 'Bibisita ang anak na babae sa 17:00, nais ng ulat tungkol sa pangangalaga at pagkain ngayong araw',
      es: 'Su hija visitará a las 17:00, desea actualización sobre el cuidado y apetito de hoy',
      pa: 'ਧੀ 17:00 ਵਜੇ ਮਿਲਣ ਆ ਰਹੀ ਹੈ, ਅੱਜ ਦੀ ਦੇਖਭਾਲ ਅਤੇ ਭੁੱਖ ਬਾਰੇ ਅਪਡੇਟ ਚਾਹੁੰਦੀ ਹੈ',
      hi: 'बेटी 17:00 बजे मिलने आ रही है, आज की देखभाल और भूख के बारे में जानकारी चाहती है',
      fr: 'Sa fille vient en visite à 17:00, elle désire des nouvelles des soins et de son appétit',
      zh: '女儿将于 17:00 来访，希望能了解今天的照护情况与食欲',
      ar: 'ابنته ستزور في الساعة 17:00، وترغب في معرفة مستجدات الرعاية والشهية اليوم',
    },
  },
  {
    id: 'ph-rout-1',
    category: 'routine',
    categoryLabel: 'Routine Care Plan',
    english: 'All cares completed per care plan; no concerns noted',
    translations: {
      tl: 'Lahat ng pangangalaga ay natapos ayon sa plano ng pangangalaga; walang napansing alalahanin',
      es: 'Todos los cuidados completados según el plan de cuidados; sin novedades',
      pa: 'ਸਾਰੀ ਦੇਖਭਾਲ ਯੋਜਨਾ ਅਨੁਸਾਰ ਮੁਕੰਮਲ ਕੀਤੀ ਗਈ; ਕੋਈ ਚਿੰਤਾ ਨਹੀਂ ਹੈ',
      hi: 'सभी देखभाल योजना के अनुसार पूरी की गई; कोई चिंता नहीं देखी गई',
      fr: 'Tous les soins complétés selon le plan de soins; aucune inquiétude notée',
      zh: '所有护理均按照护计划完成；未见异常',
      ar: 'تم إكمال جميع إجراءات الرعاية وفقاً لخطة الرعاية؛ لا توجد أي ملاحظات',
    },
  },
];
