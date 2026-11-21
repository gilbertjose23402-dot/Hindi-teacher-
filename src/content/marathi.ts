/**
 * Marathi from zero: 14 short units, written by hand (not generated) so the
 * phrases are reliable. Each phrase has the Hindi equivalent as a bridge,
 * because the learner already understands Hindi well.
 *
 * Gendered sentences have a feminine variant (mrF/romanF) used when the
 * learner speaks about herself with feminine forms.
 */

export interface Phrase {
  mr: string
  mrF?: string
  roman: string
  romanF?: string
  en: string
  hi: string
}

export interface Unit {
  id: string
  no: number
  title: string
  titleMr: string
  goal: string
  skills: string[]
  phrases: Phrase[]
  grammar: { title: string; points: string[] }
  hindiBridge: string
  malayalam?: string
  /** Situation for the practice conversation with Rani. */
  scenario: string
}

export const NAME_SLOT = '{name}'

export const MARATHI_UNITS: Unit[] = [
  {
    id: 'u1',
    no: 1,
    title: 'Hello! Introducing yourself',
    titleMr: 'नमस्कार!',
    goal: 'Greet someone, say your name, what you do and where you live.',
    skills: ['mr_be', 'mr_gender', 'mr_vocab'],
    phrases: [
      { mr: 'नमस्कार!', roman: 'namaskaar!', en: 'Hello! (polite)', hi: 'नमस्ते!' },
      { mr: `माझं नाव ${NAME_SLOT} आहे.`, roman: `maajha naav ${NAME_SLOT} aahe.`, en: `My name is ${NAME_SLOT}.`, hi: `मेरा नाम ${NAME_SLOT} है।` },
      { mr: 'तुमचं नाव काय आहे?', roman: 'tumcha naav kaay aahe?', en: 'What is your name?', hi: 'आपका नाम क्या है?' },
      { mr: 'मी वकील आहे.', roman: 'mee vakeel aahe.', en: 'I am a lawyer.', hi: 'मैं वकील हूँ।' },
      {
        mr: 'मी पुण्यात राहतो.',
        mrF: 'मी पुण्यात राहते.',
        roman: 'mee punyaat raahto.',
        romanF: 'mee punyaat raahte.',
        en: 'I live in Pune.',
        hi: 'मैं पुणे में रहता/रहती हूँ।',
      },
      { mr: 'कसं काय?', roman: 'kasa kaay?', en: "How are you? / How's it going?", hi: 'क्या हाल है?' },
      { mr: 'मी मजेत आहे, धन्यवाद.', roman: 'mee majet aahe, dhanyavaad.', en: "I'm doing well, thank you.", hi: 'मैं मज़े में हूँ, धन्यवाद।' },
      { mr: 'भेटून आनंद झाला.', roman: 'bhetoon aanand jhaalaa.', en: 'Nice to meet you.', hi: 'आपसे मिलकर ख़ुशी हुई।' },
    ],
    grammar: {
      title: 'आहे = है / हूँ',
      points: [
        'आहे does the job of Hindi है and हूँ: मी वकील आहे = मैं वकील हूँ.',
        'The verb comes last, just like in Hindi (and Malayalam).',
        'Marathi has THREE genders. नाव (name) is neuter, so it is माझं नाव — Hindi only has मेरा/मेरी.',
        'तुम्ही is the polite "you" (Hindi आप).',
      ],
    },
    hindiBridge: 'Many words are shared (नमस्कार, धन्यवाद, वकील) — the small words change: है → आहे, मेरा → माझा/माझी/माझं, आप → तुम्ही.',
    malayalam: 'The neuter gender will feel familiar: Malayalam also treats things as neuter (അത്), and Marathi does the same with ते.',
    scenario: 'Meeting a new colleague in the Pune court canteen and introducing yourselves.',
  },
  {
    id: 'u2',
    no: 2,
    title: 'He, she, they — people and places',
    titleMr: 'तो, ती, ते',
    goal: 'Say who people are and where they are.',
    skills: ['mr_be', 'mr_gender'],
    phrases: [
      { mr: 'तू कुठे आहेस?', roman: 'too kuthe aahes?', en: 'Where are you? (to a friend)', hi: 'तू कहाँ है?' },
      { mr: 'तुम्ही कुठे आहात?', roman: 'tumhee kuthe aahaat?', en: 'Where are you? (polite)', hi: 'आप कहाँ हैं?' },
      { mr: 'मी कोर्टात आहे.', roman: 'mee kortaat aahe.', en: 'I am in court.', hi: 'मैं कोर्ट में हूँ।' },
      { mr: 'तो माझा मित्र आहे.', roman: 'to maajhaa mitra aahe.', en: 'He is my friend.', hi: 'वह मेरा दोस्त है।' },
      { mr: 'ती माझी बहीण आहे.', roman: 'tee maajhee baheen aahe.', en: 'She is my sister.', hi: 'वह मेरी बहन है।' },
      { mr: 'आम्ही वकील आहोत.', roman: 'aamhee vakeel aahot.', en: 'We are lawyers.', hi: 'हम वकील हैं।' },
      { mr: 'ते घरी आहेत.', roman: 'te gharee aahet.', en: 'They are at home.', hi: 'वे घर पर हैं।' },
    ],
    grammar: {
      title: 'मी, तू, तो, ती, ते + आहे',
      points: [
        'मी आहे · तू आहेस · तो/ती/ते आहे · आम्ही आहोत · तुम्ही आहात · ते आहेत',
        'तो = he, ती = she, ते = it (neuter) — and ते also means "they" or a respected "he".',
        'Hindi uses वह for both he and she; Marathi does not.',
        'घरी = at home (a special form, like Hindi घर पर).',
      ],
    },
    hindiBridge: 'मैं हूँ → मी आहे, हम हैं → आम्ही आहोत, आप हैं → तुम्ही आहात.',
    malayalam: 'Malayalam has അവൻ (he), അവൾ (she) and അത് (it) — Marathi तो, ती and ते work the same way.',
    scenario: 'Showing a friend family photos and saying who everyone is and where they are now.',
  },
  {
    id: 'u3',
    no: 3,
    title: 'What you do every day',
    titleMr: 'मी काम करतो',
    goal: 'Talk about your habits and work in the present tense.',
    skills: ['mr_present'],
    phrases: [
      {
        mr: 'मी रोज कोर्टात जातो.',
        mrF: 'मी रोज कोर्टात जाते.',
        roman: 'mee roj kortaat jaato.',
        romanF: 'mee roj kortaat jaate.',
        en: 'I go to court every day.',
        hi: 'मैं रोज़ कोर्ट जाता/जाती हूँ।',
      },
      {
        mr: 'मी मराठी शिकतो.',
        mrF: 'मी मराठी शिकते.',
        roman: 'mee maraathee shikto.',
        romanF: 'mee maraathee shikte.',
        en: 'I am learning Marathi.',
        hi: 'मैं मराठी सीखता/सीखती हूँ।',
      },
      { mr: 'तुम्ही काय करता?', roman: 'tumhee kaay karta?', en: 'What do you do?', hi: 'आप क्या करते हैं?' },
      { mr: 'तो इंग्रजी बोलतो.', roman: 'to ingrajee bolto.', en: 'He speaks English.', hi: 'वह अंग्रेज़ी बोलता है।' },
      { mr: 'ती चहा पिते.', roman: 'tee chahaa pite.', en: 'She drinks tea.', hi: 'वह चाय पीती है।' },
      { mr: 'आम्ही दुपारी जेवतो.', roman: 'aamhee dupaaree jevto.', en: 'We have lunch in the afternoon.', hi: 'हम दोपहर में खाना खाते हैं।' },
      { mr: 'ते पुण्यात राहतात.', roman: 'te punyaat raahtaat.', en: 'They live in Pune.', hi: 'वे पुणे में रहते हैं।' },
    ],
    grammar: {
      title: 'One word does it all',
      points: [
        'Hindi needs two words (करता हूँ); Marathi uses one: करतो.',
        'मी करतो/करते · तू करतोस/करतेस · तो करतो · ती करते · आम्ही करतो · तुम्ही करता · ते करतात',
        'Do not add आहे: "मी करतो आहे" means "I am doing it right now" — a different tense.',
        'जेवणे = to eat a meal (Hindi खाना खाना).',
      ],
    },
    hindiBridge: 'मैं काम करता हूँ → मी काम करतो (no हूँ!).',
    scenario: 'Telling Rani about a normal working day at the Pune courts and asking about hers.',
  },
  {
    id: 'u4',
    no: 4,
    title: 'Asking questions',
    titleMr: 'कुठे? कधी?',
    goal: 'Ask what, where, when, who and how much — and yes/no questions.',
    skills: ['mr_questions', 'mr_vocab'],
    phrases: [
      { mr: 'हे काय आहे?', roman: 'he kaay aahe?', en: 'What is this?', hi: 'यह क्या है?' },
      { mr: 'कोर्ट कुठे आहे?', roman: 'kort kuthe aahe?', en: 'Where is the court?', hi: 'कोर्ट कहाँ है?' },
      { mr: 'सुनावणी कधी आहे?', roman: 'sunaavanee kadhee aahe?', en: 'When is the hearing?', hi: 'सुनवाई कब है?' },
      { mr: 'ते कोण आहेत?', roman: 'te kon aahet?', en: 'Who is he? (respectful) / Who are they?', hi: 'वे कौन हैं?' },
      { mr: 'याची किंमत किती आहे?', roman: 'yaachee kimmat kitee aahe?', en: 'How much does this cost?', hi: 'इसकी क़ीमत कितनी है?' },
      { mr: 'तुम्ही वकील आहात का?', roman: 'tumhee vakeel aahaat kaa?', en: 'Are you a lawyer?', hi: 'क्या आप वकील हैं?' },
      { mr: 'तुम्ही मराठी का शिकता?', roman: 'tumhee maraathee kaa shikta?', en: 'Why do you learn Marathi?', hi: 'आप मराठी क्यों सीखते हैं?' },
    ],
    grammar: {
      title: 'का at the end = a question',
      points: [
        'Yes/no question: put का at the END — तुम्ही वकील आहात का? (Hindi puts क्या at the start).',
        'का in the middle means "why": तुम्ही मराठी का शिकता?',
        'काय = what (क्या) · कुठे = where (कहाँ) · कधी = when (कब) · कोण = who (कौन) · किती = how much (कितना).',
      ],
    },
    hindiBridge: 'क्या आप वकील हैं? → तुम्ही वकील आहात का?',
    scenario: 'At the court reception, asking where things are and when your hearing is.',
  },
  {
    id: 'u5',
    no: 5,
    title: 'In, on, to, from — word endings',
    titleMr: 'घरात, कोर्टात',
    goal: 'Say where things are, where you go and where you come from.',
    skills: ['mr_case_endings'],
    phrases: [
      { mr: 'मी घरात आहे.', roman: 'mee gharaat aahe.', en: 'I am in the house.', hi: 'मैं घर में हूँ।' },
      { mr: 'फाईल टेबलावर आहे.', roman: 'faail tebalaavar aahe.', en: 'The file is on the table.', hi: 'फ़ाइल टेबल पर है।' },
      {
        mr: 'मी मुंबईला जातो.',
        mrF: 'मी मुंबईला जाते.',
        roman: 'mee mumbaeelaa jaato.',
        romanF: 'mee mumbaeelaa jaate.',
        en: 'I go to Mumbai.',
        hi: 'मैं मुंबई जाता/जाती हूँ।',
      },
      {
        mr: 'मी कोर्टातून येतो.',
        mrF: 'मी कोर्टातून येते.',
        roman: 'mee kortaatoon yeto.',
        romanF: 'mee kortaatoon yete.',
        en: 'I am coming from the court.',
        hi: 'मैं कोर्ट से आता/आती हूँ।',
      },
      { mr: 'हे पत्र तुमच्यासाठी आहे.', roman: 'he patra tumchyaasaathee aahe.', en: 'This letter is for you.', hi: 'यह पत्र आपके लिए है।' },
      {
        mr: 'मी मित्राबरोबर जेवतो.',
        mrF: 'मी मित्राबरोबर जेवते.',
        roman: 'mee mitraabarobar jevto.',
        romanF: 'mee mitraabarobar jevte.',
        en: 'I eat with a friend.',
        hi: 'मैं दोस्त के साथ खाना खाता/खाती हूँ।',
      },
      { mr: 'पुस्तक पिशवीत आहे.', roman: 'pustak pishaveet aahe.', en: 'The book is in the bag.', hi: 'किताब थैले में है।' },
    ],
    grammar: {
      title: 'Endings stick to the word',
      points: [
        '-त in: कोर्टात · -वर on: टेबलावर · -ला to: मुंबईला · -तून from: कोर्टातून · -साठी for: तुमच्यासाठी · -बरोबर with: मित्राबरोबर',
        'Hindi puts a separate word after the noun (कोर्ट में); Marathi joins it to the noun.',
        'The noun can change first: पुणे → पुण्यात, मित्र → मित्राबरोबर, पिशवी → पिशवीत.',
      ],
    },
    hindiBridge: 'कोर्ट में → कोर्टात, टेबल पर → टेबलावर, मुंबई को → मुंबईला.',
    malayalam: 'This is exactly how Malayalam works: വീട്ടിൽ (in the house) ↔ घरात, കോടതിയിൽ (in court) ↔ कोर्टात.',
    scenario: 'Helping Rani find things in the office and describing your commute.',
  },
  {
    id: 'u6',
    no: 6,
    title: 'Having things — mine and yours',
    titleMr: 'माझ्याकडे',
    goal: 'Say what you have and whose things are.',
    skills: ['mr_possession', 'mr_gender'],
    phrases: [
      { mr: 'माझ्याकडे गाडी आहे.', roman: 'maajhyaakade gaadee aahe.', en: 'I have a car.', hi: 'मेरे पास गाड़ी है।' },
      { mr: 'तुमच्याकडे पेन आहे का?', roman: 'tumchyaakade pen aahe kaa?', en: 'Do you have a pen?', hi: 'क्या आपके पास पेन है?' },
      { mr: 'माझ्याकडे वेळ नाही.', roman: 'maajhyaakade vel naahee.', en: "I don't have time.", hi: 'मेरे पास समय नहीं है।' },
      { mr: 'माझा एक भाऊ आहे.', roman: 'maajhaa ek bhaaoo aahe.', en: 'I have a brother.', hi: 'मेरा एक भाई है।' },
      { mr: 'माझी एक बहीण आहे.', roman: 'maajhee ek baheen aahe.', en: 'I have a sister.', hi: 'मेरी एक बहन है।' },
      { mr: 'माझं घर लहान आहे.', roman: 'maajha ghar lahaan aahe.', en: 'My house is small.', hi: 'मेरा घर छोटा है।' },
      { mr: 'ही फाईल कोणाची आहे?', roman: 'hee faail konaachee aahe?', en: 'Whose file is this?', hi: 'यह फ़ाइल किसकी है?' },
    ],
    grammar: {
      title: 'माझा / माझी / माझं',
      points: [
        '"I have" = माझ्याकडे … आहे (Hindi मेरे पास … है). "Not" = नाही.',
        'My: माझा (masc: भाऊ) · माझी (fem: बहीण) · माझं (neuter: घर) · माझे (plural or respect: आई-वडील).',
        'Your (polite): तुमचा / तुमची / तुमचं. Whose: कोणाचा / कोणाची / कोणाचं.',
        'This: हा (masc) · ही (fem) · हे (neuter).',
      ],
    },
    hindiBridge: 'मेरे पास समय नहीं है → माझ्याकडे वेळ नाही (वेळ = time).',
    scenario: 'Packing for court: checking who has which files and things.',
  },
  {
    id: 'u7',
    no: 7,
    title: 'I like, I want, I know',
    titleMr: 'मला आवडतं',
    goal: 'Say what you like, want, need and know.',
    skills: ['mr_dative'],
    phrases: [
      { mr: 'मला चहा आवडतो.', roman: 'malaa chahaa aavadto.', en: 'I like tea.', hi: 'मुझे चाय पसंद है।' },
      { mr: 'मला मराठी आवडते.', roman: 'malaa maraathee aavadte.', en: 'I like Marathi.', hi: 'मुझे मराठी पसंद है।' },
      { mr: 'मला हे काम आवडतं.', roman: 'malaa he kaam aavadta.', en: 'I like this work.', hi: 'मुझे यह काम पसंद है।' },
      { mr: 'मला पाणी हवं आहे.', roman: 'malaa paanee hava aahe.', en: 'I want water.', hi: 'मुझे पानी चाहिए।' },
      { mr: 'मला माहीत नाही.', roman: 'malaa maaheet naahee.', en: "I don't know.", hi: 'मुझे पता नहीं।' },
      { mr: 'मला भूक लागली आहे.', roman: 'malaa bhook laaglee aahe.', en: "I'm hungry.", hi: 'मुझे भूख लगी है।' },
      { mr: 'तुम्हाला काय हवं आहे?', roman: 'tumhaalaa kaay hava aahe?', en: 'What do you want?', hi: 'आपको क्या चाहिए?' },
    ],
    grammar: {
      title: 'मला = मुझे',
      points: [
        'Like Hindi मुझे: मला (me) · तुला (you) · त्याला (him) · तिला (her) · आम्हाला (us) · तुम्हाला (you, polite).',
        'The verb agrees with the THING: चहा (masc) → आवडतो · मराठी (fem) → आवडते · काम (neuter) → आवडतं.',
        'Want: हवा / हवी / हवं (agrees too) — or पाहिजे, which never changes: मला पाणी पाहिजे.',
      ],
    },
    hindiBridge: 'मुझे चाय पसंद है → मला चहा आवडतो.',
    malayalam: 'എനിക്ക് ചായ ഇഷ്ടമാണ് works exactly like मला चहा आवडतो — the "liker" takes the to-me form.',
    scenario: 'Ordering at a café near the court and talking about what you like.',
  },
  {
    id: 'u8',
    no: 8,
    title: 'Time and your daily routine',
    titleMr: 'सकाळी सात वाजता',
    goal: 'Tell the time and describe your day.',
    skills: ['mr_time', 'mr_present'],
    phrases: [
      { mr: 'किती वाजले?', roman: 'kitee vaajle?', en: 'What time is it?', hi: 'कितने बजे हैं?' },
      { mr: 'आता पाच वाजले आहेत.', roman: 'aataa paach vaajle aahet.', en: "It's five o'clock now.", hi: 'अभी पाँच बजे हैं।' },
      {
        mr: 'मी सकाळी सहा वाजता उठतो.',
        mrF: 'मी सकाळी सहा वाजता उठते.',
        roman: 'mee sakaalee sahaa vaajtaa uthto.',
        romanF: 'mee sakaalee sahaa vaajtaa uthte.',
        en: 'I get up at six in the morning.',
        hi: 'मैं सुबह छह बजे उठता/उठती हूँ।',
      },
      {
        mr: 'मी दहा वाजता कोर्टात पोहोचतो.',
        mrF: 'मी दहा वाजता कोर्टात पोहोचते.',
        roman: 'mee dahaa vaajtaa kortaat pohochto.',
        romanF: 'mee dahaa vaajtaa kortaat pohochte.',
        en: 'I reach the court at ten.',
        hi: 'मैं दस बजे कोर्ट पहुँचता/पहुँचती हूँ।',
      },
      { mr: 'आम्ही दुपारी एक वाजता जेवतो.', roman: 'aamhee dupaaree ek vaajtaa jevto.', en: 'We have lunch at one.', hi: 'हम दोपहर एक बजे खाना खाते हैं।' },
      {
        mr: 'संध्याकाळी मी घरी परत येतो.',
        mrF: 'संध्याकाळी मी घरी परत येते.',
        roman: 'sandhyaakaalee mee gharee parat yeto.',
        romanF: 'sandhyaakaalee mee gharee parat yete.',
        en: 'In the evening I come back home.',
        hi: 'शाम को मैं घर वापस आता/आती हूँ।',
      },
      {
        mr: 'रात्री मी पुस्तक वाचतो.',
        mrF: 'रात्री मी पुस्तक वाचते.',
        roman: 'raatree mee pustak vaachto.',
        romanF: 'raatree mee pustak vaachte.',
        en: 'At night I read a book.',
        hi: 'रात को मैं किताब पढ़ता/पढ़ती हूँ।',
      },
    ],
    grammar: {
      title: 'सकाळी … वाजता',
      points: [
        "At X o'clock = X वाजता: सात वाजता (at seven).",
        'Times of day take -ई: सकाळी (in the morning) · दुपारी (afternoon) · संध्याकाळी (evening) · रात्री (at night).',
        '1–12: एक, दोन, तीन, चार, पाच, सहा, सात, आठ, नऊ, दहा, अकरा, बारा.',
        'वाचणे = to read (Hindi पढ़ना).',
      ],
    },
    hindiBridge: 'सुबह सात बजे → सकाळी सात वाजता.',
    scenario: 'Planning a meeting time with a colleague and comparing your daily routines.',
  },
  {
    id: 'u9',
    no: 9,
    title: 'I went, I came — the past',
    titleMr: 'मी काल गेलो',
    goal: 'Say where you went and when you came.',
    skills: ['mr_past_intr'],
    phrases: [
      {
        mr: 'मी काल कोर्टात गेलो.',
        mrF: 'मी काल कोर्टात गेले.',
        roman: 'mee kaal kortaat gelo.',
        romanF: 'mee kaal kortaat gele.',
        en: 'I went to court yesterday.',
        hi: 'मैं कल कोर्ट गया/गई।',
      },
      {
        mr: 'मी उशिरा आलो.',
        mrF: 'मी उशिरा आले.',
        roman: 'mee ushiraa aalo.',
        romanF: 'mee ushiraa aale.',
        en: 'I came late.',
        hi: 'मैं देर से आया/आई।',
      },
      { mr: 'तो घरी गेला.', roman: 'to gharee gelaa.', en: 'He went home.', hi: 'वह घर गया।' },
      { mr: 'ती खुर्चीवर बसली.', roman: 'tee khurcheevar baslee.', en: 'She sat on the chair.', hi: 'वह कुर्सी पर बैठी।' },
      { mr: 'तुम्ही कधी आलात?', roman: 'tumhee kadhee aalaat?', en: 'When did you come?', hi: 'आप कब आए?' },
      { mr: 'आम्ही थकलो.', roman: 'aamhee thaklo.', en: 'We got tired.', hi: 'हम थक गए।' },
      { mr: 'ते पुण्याला परत गेले.', roman: 'te punyaalaa parat gele.', en: 'They went back to Pune.', hi: 'वे पुणे वापस गए।' },
    ],
    grammar: {
      title: 'गेलो, गेले, गेला',
      points: [
        'Like Hindi गया/गई, the verb agrees with the person who went — and it also shows the person: गेलो = I went (man), गेले = I went (woman).',
        'मी गेलो/गेले · तू गेलास/गेलीस · तो गेला · ती गेली · आम्ही गेलो · तुम्ही गेलात · ते गेले',
        'काल = yesterday and उद्या = tomorrow — no confusion like Hindi कल!',
      ],
    },
    hindiBridge: 'मैं कल गया → मी काल गेलो. Hindi कल means both yesterday and tomorrow; Marathi has काल and उद्या.',
    scenario: 'Telling Rani what happened yesterday: where you went and when you got back.',
  },
  {
    id: 'u10',
    no: 10,
    title: 'I did, I wrote — past with objects',
    titleMr: 'मी काम केलं',
    goal: 'Say what you did, ate, wrote or read.',
    skills: ['mr_past_tr'],
    phrases: [
      { mr: 'मी काम केलं.', roman: 'mee kaam kela.', en: 'I did the work.', hi: 'मैंने काम किया।' },
      { mr: 'मी आंबा खाल्ला.', roman: 'mee aambaa khaallaa.', en: 'I ate a mango.', hi: 'मैंने आम खाया।' },
      { mr: 'मी चिठ्ठी लिहिली.', roman: 'mee chiththee lihilee.', en: 'I wrote a note.', hi: 'मैंने चिट्ठी लिखी।' },
      { mr: 'त्याने फाईल वाचली.', roman: 'tyaane faail vaachlee.', en: 'He read the file.', hi: 'उसने फ़ाइल पढ़ी।' },
      { mr: 'तिने मला फोन केला.', roman: 'tine malaa fon kelaa.', en: 'She phoned me.', hi: 'उसने मुझे फ़ोन किया।' },
      { mr: 'तुम्ही काय खाल्लंत?', roman: 'tumhee kaay khaallat?', en: 'What did you eat?', hi: 'आपने क्या खाया?' },
      { mr: 'न्यायाधीशांनी निकाल दिला.', roman: 'nyaayaadheeshaannee nikaal dilaa.', en: 'The judge gave the verdict.', hi: 'न्यायाधीश ने फ़ैसला दिया।' },
    ],
    grammar: {
      title: 'Just like Hindi ने',
      points: [
        'With verbs that take an object, the past verb agrees with the OBJECT: काम (neuter) → केलं · आंबा (masc) → खाल्ला · चिठ्ठी (fem) → लिहिली.',
        'The 3rd person adds ने/नी, like Hindi: त्याने (he), तिने (she), त्यांनी (they / respect). मी, तू, आम्ही, तुम्ही do not take it.',
        'With तू / तुम्ही the verb adds -स / -त: तू काय केलंस? · तुम्ही काय केलंत?',
      ],
    },
    hindiBridge: 'मैंने काम किया → मी काम केलं; उसने फ़ाइल पढ़ी → त्याने फाईल वाचली. The ने rule you practise in Hindi works here too.',
    scenario: 'Reporting to your senior what work you did today at court.',
  },
  {
    id: 'u11',
    no: 11,
    title: 'Plans — the future',
    titleMr: 'मी उद्या येईन',
    goal: 'Talk about tomorrow, next week and the next date.',
    skills: ['mr_future'],
    phrases: [
      { mr: 'मी उद्या येईन.', roman: 'mee udyaa yeeen.', en: 'I will come tomorrow.', hi: 'मैं कल आऊँगा/आऊँगी।' },
      { mr: 'मी फाईल पाठवीन.', roman: 'mee faail paathveen.', en: 'I will send the file.', hi: 'मैं फ़ाइल भेजूँगा/भेजूँगी।' },
      { mr: 'तुम्ही कधी याल?', roman: 'tumhee kadhee yaal?', en: 'When will you come?', hi: 'आप कब आएँगे?' },
      { mr: 'सुनावणी सोमवारी होईल.', roman: 'sunaavanee somvaaree hoeel.', en: 'The hearing will be on Monday.', hi: 'सुनवाई सोमवार को होगी।' },
      { mr: 'आम्ही नंतर भेटू.', roman: 'aamhee nantar bhetoo.', en: "We'll meet later.", hi: 'हम बाद में मिलेंगे।' },
      { mr: 'तो पैसे देईल.', roman: 'to paise deeel.', en: 'He will pay.', hi: 'वह पैसे देगा।' },
      { mr: 'ते उद्या निकाल देतील.', roman: 'te udyaa nikaal deteel.', en: 'They will give the verdict tomorrow.', hi: 'वे कल फ़ैसला देंगे।' },
    ],
    grammar: {
      title: '-ईन, -शील, -ईल',
      points: [
        'मी करेन/येईन · तू करशील · तो/ती करेल · आम्ही करू · तुम्ही कराल · ते करतील',
        'Good news: the future does NOT change for gender (मी येईन for everyone), unlike Hindi आऊँगा/आऊँगी.',
        'Days take -ई: सोमवारी (on Monday), मंगळवारी (on Tuesday).',
      ],
    },
    hindiBridge: 'मैं कल आऊँगा → मी उद्या येईन (उद्या = tomorrow).',
    scenario: 'Planning next week: hearings, meetings and a weekend trip.',
  },
  {
    id: 'u12',
    no: 12,
    title: 'Please sit, please wait — requests',
    titleMr: 'बसा, सांगा',
    goal: 'Ask people politely to do things.',
    skills: ['mr_requests'],
    phrases: [
      { mr: 'कृपया बसा.', roman: 'krupayaa basaa.', en: 'Please sit.', hi: 'कृपया बैठिए।' },
      { mr: 'इकडे या.', roman: 'ikade yaa.', en: 'Come here, please.', hi: 'इधर आइए।' },
      { mr: 'जरा थांबा.', roman: 'jaraa thaambaa.', en: 'Wait a moment.', hi: 'ज़रा रुकिए।' },
      { mr: 'पुन्हा सांगा.', roman: 'punhaa saangaa.', en: 'Please say it again.', hi: 'फिर से बताइए।' },
      { mr: 'हळू बोला.', roman: 'haloo bolaa.', en: 'Please speak slowly.', hi: 'धीरे बोलिए।' },
      { mr: 'मला मदत कराल का?', roman: 'malaa madat karaal kaa?', en: 'Will you help me?', hi: 'क्या आप मेरी मदद करेंगे?' },
      { mr: 'एक कप चहा द्या.', roman: 'ek kap chahaa dyaa.', en: 'A cup of tea, please.', hi: 'एक कप चाय दीजिए।' },
    ],
    grammar: {
      title: 'बसा, या, सांगा',
      points: [
        'Polite request = verb + आ: बसा (sit) · थांबा (wait) · सांगा (tell) · बोला (speak) · द्या (give) · या (come).',
        'To a friend: बस, थांब, सांग, बोल, दे, ये.',
        'Extra polite: …ाल का? — मदत कराल का? (Will you help?)',
      ],
    },
    hindiBridge: 'बैठिए → बसा, रुकिए → थांबा, बताइए → सांगा.',
    scenario: 'Welcoming a client into your office: asking them to sit, wait and repeat things.',
  },
  {
    id: 'u13',
    no: 13,
    title: 'Getting around Pune',
    titleMr: 'रिक्षा आणि रस्ता',
    goal: 'Take a rickshaw, give directions and ask the fare.',
    skills: ['mr_requests', 'mr_case_endings', 'mr_dative'],
    phrases: [
      { mr: 'दादा, शिवाजीनगर कोर्टाला चला.', roman: 'daadaa, shivaajeenagar kortaalaa chalaa.', en: "Let's go to Shivajinagar court, please (to the driver).", hi: 'भैया, शिवाजीनगर कोर्ट चलिए।' },
      { mr: 'मला कोर्टात जायचं आहे.', roman: 'malaa kortaat jaayacha aahe.', en: 'I have to go to court.', hi: 'मुझे कोर्ट जाना है।' },
      { mr: 'इथून किती लांब आहे?', roman: 'ithoon kitee laamb aahe?', en: 'How far is it from here?', hi: 'यहाँ से कितनी दूर है?' },
      { mr: 'सरळ जा, मग डावीकडे वळा.', roman: 'saral jaa, mag daaveekade valaa.', en: 'Go straight, then turn left.', hi: 'सीधे जाइए, फिर बाएँ मुड़िए।' },
      { mr: 'उजवीकडे थांबवा.', roman: 'ujveekade thaambvaa.', en: 'Stop on the right.', hi: 'दाईं तरफ़ रोकिए।' },
      { mr: 'किती पैसे झाले?', roman: 'kitee paise jhaale?', en: 'How much is it?', hi: 'कितने पैसे हुए?' },
      { mr: 'मला उशीर झाला आहे.', roman: 'malaa usheer jhaalaa aahe.', en: "I'm late.", hi: 'मुझे देर हो गई है।' },
    ],
    grammar: {
      title: 'मला … जायचं आहे',
      points: [
        '"I have to go" = मला जायचं आहे (Hindi मुझे जाना है).',
        'Directions take -कडे: डावीकडे (to the left) · उजवीकडे (to the right) · इकडे (here) · तिकडे (there).',
        'जा (go) is the same for तू and तुम्ही.',
      ],
    },
    hindiBridge: 'मुझे जाना है → मला जायचं आहे; बाएँ → डावीकडे, दाएँ → उजवीकडे.',
    scenario: 'Taking a rickshaw from Pune station to the Shivajinagar court and paying the fare.',
  },
  {
    id: 'u14',
    no: 14,
    title: 'At the court',
    titleMr: 'न्यायालयात',
    goal: 'Handle simple court Marathi: dates, presence and applications.',
    skills: ['mr_vocab', 'mr_past_tr'],
    phrases: [
      { mr: 'पुढची तारीख कधी आहे?', roman: 'pudhchee taareekh kadhee aahe?', en: 'When is the next date?', hi: 'अगली तारीख कब है?' },
      { mr: 'आरोपी हजर आहे.', roman: 'aaropee hajar aahe.', en: 'The accused is present.', hi: 'आरोपी हाज़िर है।' },
      { mr: 'साक्षीदार गैरहजर आहे.', roman: 'saakshidaar gairhajar aahe.', en: 'The witness is absent.', hi: 'गवाह ग़ैरहाज़िर है।' },
      { mr: 'मी जामिनासाठी अर्ज केला आहे.', roman: 'mee jaaminaasaathee arj kelaa aahe.', en: 'I have filed an application for bail.', hi: 'मैंने ज़मानत के लिए अर्ज़ी दी है।' },
      { mr: 'प्रकरण सुनावणीसाठी आहे.', roman: 'prakaran sunaavaneesaathee aahe.', en: 'The matter is listed for hearing.', hi: 'मामला सुनवाई के लिए है।' },
      { mr: 'माझ्या अशिलाची बाजू ऐकून घ्या.', roman: 'maajhyaa ashilaachee baajoo aikoon ghyaa.', en: "Please hear my client's side.", hi: 'मेरे मुवक्किल का पक्ष सुन लीजिए।' },
      { mr: 'फिर्याद कोणी दाखल केली?', roman: 'phiryaad konee daakhal kelee?', en: 'Who filed the complaint?', hi: 'शिकायत किसने दर्ज की?' },
    ],
    grammar: {
      title: 'Court Marathi you already half-know',
      points: [
        'Many court words are shared with Hindi/Urdu: हजर (present), गैरहजर (absent), अर्ज (application), तारीख (date).',
        'New words: फिर्याद (complaint; फिर्यादी = complainant) · साक्षीदार (witness) · अशील (client) · जामीन (bail) · सुनावणी (hearing) · निकाल (judgment).',
        'केला आहे = has done (Hindi किया है): मी अर्ज केला आहे.',
      ],
    },
    hindiBridge: 'मैंने अर्ज़ी दी है → मी अर्ज केला आहे; गवाह → साक्षीदार; मुवक्किल → अशील.',
    scenario: "At the Pune Sessions Court: checking your matter's next date with the clerk and telling the judge who is present.",
  },
]

export const UNIT_BY_ID: Record<string, Unit> = Object.fromEntries(MARATHI_UNITS.map((u) => [u.id, u]))

/** The phrase as the learner should say it (feminine forms for a woman), with the name filled in. */
export function phraseFor(p: Phrase, gender: 'm' | 'f', name: string): { mr: string; roman: string; en: string; hi: string } {
  const fill = (t: string) => t.split(NAME_SLOT).join(name || '…')
  const fem = gender === 'f'
  return {
    mr: fill(fem && p.mrF ? p.mrF : p.mr),
    roman: fill(fem && p.romanF ? p.romanF : p.roman),
    en: fill(p.en),
    hi: fill(p.hi),
  }
}

export interface UnitProgressLike {
  completed: boolean
}

/** Units open in order; the manual override opens all of them. */
export function unitUnlocked(unit: Unit, progress: Record<string, UnitProgressLike> | undefined, unlockAll: boolean): boolean {
  if (unlockAll || unit.no === 1) return true
  const prev = MARATHI_UNITS[unit.no - 2]
  return !!progress?.[prev.id]?.completed
}

/** The first unit not yet completed (or the last one when all are done). */
export function nextUnit(progress: Record<string, UnitProgressLike> | undefined): Unit {
  return MARATHI_UNITS.find((u) => !progress?.[u.id]?.completed) ?? MARATHI_UNITS[MARATHI_UNITS.length - 1]
}

export function unitsCompleted(progress: Record<string, UnitProgressLike> | undefined): number {
  return MARATHI_UNITS.filter((u) => progress?.[u.id]?.completed).length
}
