import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type Language = 'en' | 'hi' | 'gu' | 'mr';

export const LANGUAGE_STORAGE_KEY = 'jv_language_preference';

export interface LanguageMeta {
  code: Language;
  name: string;
  englishName: string;
  script: string;
  badge: string;
  region: string;
  sampleGreeting: string;
  sampleNotice: string;
}

export const SUPPORTED_LANGUAGES: LanguageMeta[] = [
  {
    code: 'en',
    name: 'English',
    englishName: 'English',
    script: 'Latin Alphabet',
    badge: 'Standard',
    region: 'Corporate & Global Advisory',
    sampleGreeting: 'Welcome back',
    sampleNotice: 'GST & TDS Filings On Schedule',
  },
  {
    code: 'hi',
    name: 'हिन्दी',
    englishName: 'Hindi',
    script: 'देवनागरी (Devanagari)',
    badge: 'राजभाषा',
    region: 'राष्ट्रीय एवं कॉर्पोरेट कर अनुपालन',
    sampleGreeting: 'स्वागत है',
    sampleNotice: 'जीएसटी और टीडीएस फाइलिंग समय पर पूर्ण',
  },
  {
    code: 'gu',
    name: 'ગુજરાતી',
    englishName: 'Gujarati',
    script: 'ગુજરાતી લિપિ (Gujarati)',
    badge: 'પ્રાદેશિક',
    region: 'વેપાર, વાણિજ્ય અને જીએસટી કર પરામર્શ',
    sampleGreeting: 'આપનું સ્વાગત છે',
    sampleNotice: 'જીએસટી અને ટીડીએસ ફાઇલિંગ સમયસર પૂર્ણ',
  },
  {
    code: 'mr',
    name: 'मराठी',
    englishName: 'Marathi',
    script: 'देवनागरी (Devanagari)',
    badge: 'प्रादेशिक',
    region: 'उद्योग, कंपनी कायदा आणि कर सल्लागार (महाराष्ट्र)',
    sampleGreeting: 'आपले स्वागत आहे',
    sampleNotice: 'जीएसटी आणि टीडीएस विवरणपत्रे वेळेवर पूर्ण',
  },
];

export const TRANSLATIONS: Record<Language, Record<string, string>> = {
  en: {
    'profile.title': 'Your profile',
    'profile.description': 'Your personal details, preferred language, notification settings, and active device sessions.',
    'profile.detailsTitle': 'Personal Details',
    'profile.detailsDesc': 'Your registered email is tied to account credentials and cannot be edited here.',
    'profile.fullName': 'Full Name',
    'profile.mobile': 'Mobile Phone',
    'profile.saveChanges': 'Save changes',
    'profile.saving': 'Saving your profile...',
    'profile.savedSuccess': 'Profile details saved successfully',

    'language.title': 'Language & Regional Preferences',
    'language.description': 'Select your preferred language for JV Tax Consultancy. This configures portal interfaces, statutory filing summaries, and advisory notices.',
    'language.active': 'Active Working Language',
    'language.instantApply': 'Changes apply immediately across all portal screens and navigation.',
    'language.previewTitle': 'Live Language Preview',
    'language.previewStatus': 'Statutory Compliance Status',
    'language.switchedToast': 'Language updated to',

    'nav.services': 'Services',
    'nav.whyUs': 'Why Us',
    'nav.clientPortal': 'Client Portal',
    'nav.statutoryRadar': 'Statutory Radar',
    'nav.entityRoadmaps': 'Entity Roadmaps',
    'nav.security': 'Security & Trust',
    'nav.faq': 'FAQ',
    'nav.bookConsultation': 'Book Consultation',
    'nav.teamLogin': 'Team Login',

    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.close': 'Close',
    'common.search': 'Search',
    'common.download': 'Download',
    'common.verified': 'Verified',
    'sidebar.dashboard': 'Dashboard',
    'sidebar.myWork': 'My work',
    'sidebar.clients': 'Clients',
    'sidebar.filings': 'Filings',
    'sidebar.automation': 'Automation',
    'sidebar.tasks': 'Tasks',
    'sidebar.documents': 'Documents',
    'sidebar.converter': 'File Converter',
    'sidebar.requests': 'Requests',
    'sidebar.messages': 'Messages',
    'sidebar.reports': 'Reports',
    'sidebar.settings': 'Settings',
    'dashboard.greeting': 'Good to see you',
    'dashboard.descAdmin': 'Firm-wide figures across every client.',
    'dashboard.descUser': 'Everything below is scoped to the clients assigned to you.',
    'dashboard.openMyWork': 'Open my work',
    'dashboard.addClient': 'Add client',
    'dashboard.errorLoad': 'The dashboard did not load',
    'dashboard.stats.clients': 'Clients',
    'dashboard.stats.overdue': 'Overdue filings',
    'dashboard.stats.awaiting': 'Awaiting client',
    'dashboard.stats.openRequests': 'Open requests',
    'dashboard.buckets.7days': 'Due within 7 days',
    'dashboard.buckets.14days': 'Due within 14 days',
    'dashboard.buckets.30days': 'Due within 30 days',
    'dashboard.buckets.title': 'What is coming up',
    'dashboard.buckets.desc': 'Filings not yet filed, by window.',
    'dashboard.tasks.title': 'Tasks by state',
    'dashboard.tasks.desc': 'Everything on your plate, grouped.',
    'dashboard.tasks.emptyTitle': 'No tasks yet',
    'dashboard.tasks.emptyDesc': 'Tasks you create or are assigned appear here, grouped by state.',
    'task.status.not_started': 'Not started',
    'task.status.in_progress': 'In progress',
    'task.status.review': 'Review',
    'task.status.done': 'Done',
    'dashboard.workload.title': 'Who is carrying what',
    'dashboard.workload.desc': 'Open tasks plus open filings, per person.',
    'dashboard.workload.emptyTitle': 'No workload to show',
    'dashboard.workload.emptyDesc': 'Once work is assigned, each person\'s open item count appears here.',
    'dashboard.workload.open': 'open',
    'dashboard.workload.hasOpen': 'has {count} open items',
  },
  hi: {
    'profile.title': 'आपकी प्रोफाइल',
    'profile.description': 'आपका व्यक्तिगत विवरण, पसंदीदा भाषा, अधिसूचना सेटिंग्स और सक्रिय उपकरण सत्र।',
    'profile.detailsTitle': 'व्यक्तिगत विवरण',
    'profile.detailsDesc': 'आपका पंजीकृत ईमेल खाते से जुड़ा है और इसे यहां नहीं बदला जा सकता।',
    'profile.fullName': 'पूरा नाम',
    'profile.mobile': 'मोबाइल नंबर',
    'profile.saveChanges': 'बदलाव सहेजें',
    'profile.saving': 'प्रोफाइल सहेजा जा रहा है...',
    'profile.savedSuccess': 'प्रोफाइल विवरण सफलतापूर्वक सहेजा गया',

    'language.title': 'भाषा एवं क्षेत्रीय प्राथमिकताएं',
    'language.description': 'JV Tax Consultancy के लिए अपनी पसंदीदा भाषा चुनें। यह पोर्टल इंटरफेस, वैधानिक फाइलिंग सारांश और परामर्श सूचनाओं को अनुकूलित करता है।',
    'language.active': 'सक्रिय कार्य भाषा',
    'language.instantApply': 'बदलाव तुरंत सभी पोर्टल स्क्रीन और नेविगेशन पर लागू होते हैं।',
    'language.previewTitle': 'सक्रिय भाषा पूर्वावलोकन',
    'language.previewStatus': 'वैधानिक अनुपालन स्थिति',
    'language.switchedToast': 'भाषा सफलतापूर्वक बदली गई:',

    'nav.services': 'सेवाएं',
    'nav.whyUs': 'हमारी विशेषताएं',
    'nav.clientPortal': 'क्लाइंट पोर्टल',
    'nav.statutoryRadar': 'वैधानिक रडार',
    'nav.entityRoadmaps': 'संस्था रोडमैप',
    'nav.security': 'सुरक्षा एवं विश्वास',
    'nav.faq': 'सामान्य प्रश्न',
    'nav.bookConsultation': 'परामर्श बुक करें',
    'nav.teamLogin': 'सीए टीम लॉगिन',

    'common.save': 'सहेजें',
    'common.cancel': 'रद्द करें',
    'common.close': 'बंद करें',
    'common.search': 'खोजें',
    'common.download': 'डाउनलोड करें',
    'common.verified': 'सत्यापित',
    'sidebar.dashboard': 'डैशबोर्ड',
    'sidebar.myWork': 'मेरा काम',
    'sidebar.clients': 'क्लाइंट्स',
    'sidebar.filings': 'फाइलिंग',
    'sidebar.automation': 'ऑटोमेशन',
    'sidebar.tasks': 'टास्क',
    'sidebar.documents': 'दस्तावेज़',
    'sidebar.converter': 'फ़ाइल कनवर्टर',
    'sidebar.requests': 'अनुरोध',
    'sidebar.messages': 'संदेश',
    'sidebar.reports': 'रिपोर्ट',
    'sidebar.settings': 'सेटिंग्स',
    'dashboard.greeting': 'आपको देखकर खुशी हुई',
    'dashboard.descAdmin': 'हर क्लाइंट के फर्म-व्यापी आंकड़े।',
    'dashboard.descUser': 'नीचे दी गई सभी चीज़ें आपको सौंपे गए क्लाइंट्स तक सीमित हैं।',
    'dashboard.openMyWork': 'मेरा काम खोलें',
    'dashboard.addClient': 'क्लाइंट जोड़ें',
    'dashboard.errorLoad': 'डैशबोर्ड लोड नहीं हुआ',
    'dashboard.stats.clients': 'क्लाइंट्स',
    'dashboard.stats.overdue': 'लंबित फाइलिंग',
    'dashboard.stats.awaiting': 'क्लाइंट की प्रतीक्षा में',
    'dashboard.stats.openRequests': 'खुले अनुरोध',
    'dashboard.buckets.7days': '7 दिनों के भीतर देय',
    'dashboard.buckets.14days': '14 दिनों के भीतर देय',
    'dashboard.buckets.30days': '30 दिनों के भीतर देय',
    'dashboard.buckets.title': 'आगे क्या आने वाला है',
    'dashboard.buckets.desc': 'वे फाइलिंग जो अभी तक दर्ज नहीं हुई हैं, समय के अनुसार।',
    'dashboard.tasks.title': 'स्थिति के अनुसार टास्क',
    'dashboard.tasks.desc': 'आपके पास जो कुछ भी है, समूहीकृत।',
    'dashboard.tasks.emptyTitle': 'अभी तक कोई टास्क नहीं',
    'dashboard.tasks.emptyDesc': 'आपके द्वारा बनाए गए या आपको सौंपे गए टास्क यहाँ स्थिति के अनुसार समूहीकृत होकर दिखाई देते हैं।',
    'task.status.not_started': 'शुरू नहीं हुआ',
    'task.status.in_progress': 'प्रगति पर',
    'task.status.review': 'समीक्षा',
    'task.status.done': 'पूरा हुआ',
    'dashboard.workload.title': 'कौन क्या कर रहा है',
    'dashboard.workload.desc': 'खुले टास्क और खुली फाइलिंग, प्रति व्यक्ति।',
    'dashboard.workload.emptyTitle': 'दिखाने के लिए कोई कार्यभार नहीं',
    'dashboard.workload.emptyDesc': 'एक बार काम सौंपे जाने के बाद, प्रत्येक व्यक्ति के खुले आइटम की गिनती यहाँ दिखाई देती है।',
    'dashboard.workload.open': 'खुला',
    'dashboard.workload.hasOpen': 'के पास {count} खुले आइटम हैं',
  },
  gu: {
    'profile.title': 'તમારી પ્રોફાઇલ',
    'profile.description': 'તમારી વ્યક્તિગત વિગતો, પસંદગીની ભાષા, સૂચના સેટિંગ્સ અને સક્રિય ઉપકરણ સત્રો.',
    'profile.detailsTitle': 'વ્યક્તિગત વિગતો',
    'profile.detailsDesc': 'તમારું નોંધાયેલ ઇમેઇલ એકાઉન્ટ સાથે જોડાયેલું છે અને અહીં બદલી શકાતું નથી.',
    'profile.fullName': 'પૂરું નામ',
    'profile.mobile': 'મોબાઇલ નંબર',
    'profile.saveChanges': 'ફેરફારો સાચવો',
    'profile.saving': 'પ્રોફાઇલ સાચવવામાં આવી રહી છે...',
    'profile.savedSuccess': 'પ્રોફાઇલ વિગતો સફળતાપૂર્વક સાચવવામાં આવી',

    'language.title': 'ભાષા અને પ્રાદેશિક પસંદગીઓ',
    'language.description': 'JV Tax Consultancy માટે તમારી પસંદગીની ભાષા પસંદ કરો. આ પોર્ટલ ઇન્ટરફેસ, કાનૂની ફાઇલિંગ સારાંશ અને કર સલાહકાર સૂચનાઓને ગોઠવે છે.',
    'language.active': 'સક્રિય કાર્યકારી ભાષા',
    'language.instantApply': 'ફેરફારો તમામ પોર્ટલ સ્ક્રીન અને નેવિગેશન પર તરત જ લાગુ પડે છે.',
    'language.previewTitle': 'જીવંત ભાષા પૂર્વાવલોકન',
    'language.previewStatus': 'કાનૂની કર પાલન સ્થિતિ',
    'language.switchedToast': 'ભાષા સફળતાપૂર્વક અપડેટ થઈ:',

    'nav.services': 'સેવાઓ',
    'nav.whyUs': 'અમારી વિશેષતા',
    'nav.clientPortal': 'ક્લાયન્ટ પોર્ટલ',
    'nav.statutoryRadar': 'કાનૂની રડાર',
    'nav.entityRoadmaps': 'સંસ્થા રોડમેપ',
    'nav.security': 'સુરક્ષા અને વિશ્વાસ',
    'nav.faq': 'વારંવાર પૂછાતા પ્રશ્નો',
    'nav.bookConsultation': 'સલાહ બુક કરો',
    'nav.teamLogin': 'ટીમ લૉગિન',

    'common.save': 'સાચવો',
    'common.cancel': 'રદ કરો',
    'common.close': 'બંધ કરો',
    'common.search': 'શોધો',
    'common.download': 'ડાઉનલોડ કરો',
    'common.verified': 'ચકાસાયેલ',
    'sidebar.dashboard': 'ડેશબોર્ડ',
    'sidebar.myWork': 'મારું કામ',
    'sidebar.clients': 'ક્લાયન્ટ્સ',
    'sidebar.filings': 'ફાઇલિંગ',
    'sidebar.automation': 'ઓટોમેશન',
    'sidebar.tasks': 'કાર્યો',
    'sidebar.documents': 'દસ્તાવેજો',
    'sidebar.converter': 'ફાઇલ કન્વર્ટર',
    'sidebar.requests': 'વિનંતીઓ',
    'sidebar.messages': 'સંદેશા',
    'sidebar.reports': 'રિપોર્ટ્સ',
    'sidebar.settings': 'સેટિંગ્સ',
    'dashboard.greeting': 'તમને જોઈને આનંદ થયો',
    'dashboard.descAdmin': 'દરેક ક્લાયન્ટના ફર્મ-વ્યાપી આંકડા.',
    'dashboard.descUser': 'નીચેની બધી વસ્તુઓ તમને સોંપાયેલ ક્લાયન્ટ્સ સુધી મર્યાદિત છે.',
    'dashboard.openMyWork': 'મારું કામ ખોલો',
    'dashboard.addClient': 'ક્લાયન્ટ ઉમેરો',
    'dashboard.errorLoad': 'ડેશબોર્ડ લોડ થયું નથી',
    'dashboard.stats.clients': 'ક્લાયન્ટ્સ',
    'dashboard.stats.overdue': 'બાકી ફાઇલિંગ',
    'dashboard.stats.awaiting': 'ક્લાયન્ટની રાહ જોવાય છે',
    'dashboard.stats.openRequests': 'ખુલ્લી વિનંતીઓ',
    'dashboard.buckets.7days': '7 દિવસમાં બાકી',
    'dashboard.buckets.14days': '14 દિવસમાં બાકી',
    'dashboard.buckets.30days': '30 દિવસમાં બાકી',
    'dashboard.buckets.title': 'આગળ શું આવી રહ્યું છે',
    'dashboard.buckets.desc': 'ફાઇલિંગ જે હજુ સુધી ફાઇલ થઈ નથી, સમય મુજબ.',
    'dashboard.tasks.title': 'સ્થિતિ મુજબ કાર્યો',
    'dashboard.tasks.desc': 'તમારી પાસે જે પણ છે, જૂથબદ્ધ.',
    'dashboard.tasks.emptyTitle': 'હજુ કોઈ કાર્યો નથી',
    'dashboard.tasks.emptyDesc': 'તમે બનાવેલા અથવા તમને સોંપેલ કાર્યો અહીં સ્થિતિ મુજબ જૂથબદ્ધ થઈને દેખાય છે.',
    'task.status.not_started': 'શરૂ નથી થયું',
    'task.status.in_progress': 'પ્રગતિમાં',
    'task.status.review': 'સમીક્ષા',
    'task.status.done': 'પૂર્ણ',
    'dashboard.workload.title': 'કોણ શું કરી રહ્યું છે',
    'dashboard.workload.desc': 'ખુલ્લા કાર્યો અને ખુલ્લી ફાઇલિંગ, વ્યક્તિ દીઠ.',
    'dashboard.workload.emptyTitle': 'બતાવવા માટે કોઈ વર્કલોડ નથી',
    'dashboard.workload.emptyDesc': 'એકવાર કામ સોંપાયા પછી, દરેક વ્યક્તિના ખુલ્લા આઇટમ્સની ગણતરી અહીં દેખાય છે.',
    'dashboard.workload.open': 'ખુલ્લા',
    'dashboard.workload.hasOpen': 'પાસે {count} ખુલ્લા આઇટમ્સ છે',
  },
  mr: {
    'profile.title': 'आपली प्रोफाइल',
    'profile.description': 'आपले वैयक्तिक तपशील, पसंतीची भाषा, सूचना प्राधान्ये आणि सक्रिय डिव्हाइस सत्रे.',
    'profile.detailsTitle': 'वैयक्तिक तपशील',
    'profile.detailsDesc': 'आपला नोंदणीकृत ईमेल खात्याशी जोडलेला आहे आणि येथे बदलता येत नाही.',
    'profile.fullName': 'पूर्ण नाव',
    'profile.mobile': 'मोबाइल क्रमांक',
    'profile.saveChanges': 'बदल जतन करा',
    'profile.saving': 'प्रोफाइल जतन केली जात आहे...',
    'profile.savedSuccess': 'प्रोफाइल तपशील यशस्वीरीत्या जतन केले',

    'language.title': 'भाषा आणि प्रादेशिक प्राधान्ये',
    'language.description': 'JV Tax Consultancy साठी आपली पसंतीची भाषा निवडा. हे पोर्टल इंटरफेस, वैधानिक कर विवरणपत्र सारांश आणि सल्लागार सूचना संयोजित करते.',
    'language.active': 'सक्रिय कार्य भाषा',
    'language.instantApply': 'बदल त्वरित सर्व पोर्टल पडद्यावर आणि नेव्हिगेशनवर लागू होतात.',
    'language.previewTitle': 'थेट भाषा पूर्वावलोकन',
    'language.previewStatus': 'वैधानिक कर अनुपालन स्थिती',
    'language.switchedToast': 'भाषा यशस्वीरीत्या अद्ययावत केली:',

    'nav.services': 'सेवा',
    'nav.whyUs': 'आमची वैशिष्ट्ये',
    'nav.clientPortal': 'क्लायंट पोर्टल',
    'nav.statutoryRadar': 'वैधानिक रडार',
    'nav.entityRoadmaps': 'संस्था रोडमॅप',
    'nav.security': 'सुरक्षा आणि विश्वास',
    'nav.faq': 'नेहमी विचारले जाणारे प्रश्न',
    'nav.bookConsultation': 'सल्लामसलत बुक करा',
    'nav.teamLogin': 'सीए टीम लॉगिन',

    'common.save': 'जतन करा',
    'common.cancel': 'रद्द करा',
    'common.close': 'बंद करा',
    'common.search': 'शोधा',
    'common.download': 'डाउनलोड करा',
    'common.verified': 'सत्यापित',
    'sidebar.dashboard': 'डॅशबोर्ड',
    'sidebar.myWork': 'माझे काम',
    'sidebar.clients': 'क्लायंट्स',
    'sidebar.filings': 'फायलिंग',
    'sidebar.automation': 'ऑटोमेशन',
    'sidebar.tasks': 'कार्ये',
    'sidebar.documents': 'कागदपत्रे',
    'sidebar.converter': 'फाईल कन्व्हर्टर',
    'sidebar.requests': 'विनंत्या',
    'sidebar.messages': 'संदेश',
    'sidebar.reports': 'अहवाल',
    'sidebar.settings': 'सेटिंग्ज',
    'dashboard.greeting': 'तुम्हाला पाहून आनंद झाला',
    'dashboard.descAdmin': 'प्रत्येक क्लायंटचे फर्म-व्यापी आकडे.',
    'dashboard.descUser': 'खालील सर्व गोष्टी तुम्हाला सोपवलेल्या क्लायंट्सपुरत्या मर्यादित आहेत.',
    'dashboard.openMyWork': 'माझे काम उघडा',
    'dashboard.addClient': 'क्लायंट जोडा',
    'dashboard.errorLoad': 'डॅशबोर्ड लोड झाला नाही',
    'dashboard.stats.clients': 'क्लायंट्स',
    'dashboard.stats.overdue': 'थकीत फायलिंग',
    'dashboard.stats.awaiting': 'क्लायंटच्या प्रतीक्षेत',
    'dashboard.stats.openRequests': 'खुल्या विनंत्या',
    'dashboard.buckets.7days': '७ दिवसांत देय',
    'dashboard.buckets.14days': '१४ दिवसांत देय',
    'dashboard.buckets.30days': '३० दिवसांत देय',
    'dashboard.buckets.title': 'पुढे काय येणार आहे',
    'dashboard.buckets.desc': 'अद्याप दाखल न झालेली फायलिंग, वेळेनुसार.',
    'dashboard.tasks.title': 'स्थितीनुसार कार्ये',
    'dashboard.tasks.desc': 'तुमच्याकडे जे काही आहे, गटात विभागलेले.',
    'dashboard.tasks.emptyTitle': 'अद्याप कोणतीही कार्ये नाहीत',
    'dashboard.tasks.emptyDesc': 'तुम्ही तयार केलेली किंवा तुम्हाला सोपवलेली कार्ये येथे स्थितीनुसार गटबद्ध होऊन दिसतात.',
    'task.status.not_started': 'सुरू झाले नाही',
    'task.status.in_progress': 'प्रगतीपथावर',
    'task.status.review': 'पुनरावलोकन',
    'task.status.done': 'पूर्ण',
    'dashboard.workload.title': 'कोण काय करत आहे',
    'dashboard.workload.desc': 'खुली कार्ये आणि खुली फायलिंग, प्रति व्यक्ती.',
    'dashboard.workload.emptyTitle': 'दाखवण्यासाठी कोणताही कामाचा ताण नाही',
    'dashboard.workload.emptyDesc': 'एकदा काम सोपवल्यानंतर, प्रत्येक व्यक्तीच्या खुल्या आयटमची संख्या येथे दिसते.',
    'dashboard.workload.open': 'खुले',
    'dashboard.workload.hasOpen': 'कडे {count} खुले आयटम आहेत',
  },
};

export interface LanguageContextValue {
  language: Language;
  currentMeta: LanguageMeta;
  setLanguage: (lang: Language) => void;
  t: (key: string, fallback?: string) => string;
  languages: LanguageMeta[];
}

const defaultMeta = SUPPORTED_LANGUAGES[0]!;

const defaultContextValue: LanguageContextValue = {
  language: 'en',
  currentMeta: defaultMeta,
  setLanguage: () => undefined,
  t: (key: string, fallback?: string) => TRANSLATIONS.en[key] ?? fallback ?? key,
  languages: SUPPORTED_LANGUAGES,
};

const LanguageContext = createContext<LanguageContextValue>(defaultContextValue);

const readStoredLanguage = (): Language => {
  try {
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY) as Language | null;
    if (stored && (['en', 'hi', 'gu', 'mr'] as const).includes(stored)) {
      return stored;
    }
  } catch {
    // ignore
  }
  return 'en';
};

const applyLanguage = (lang: Language): void => {
  try {
    document.documentElement.lang = lang;
  } catch {
    // ignore in environments without DOM
  }
};

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(readStoredLanguage);

  useEffect(() => {
    applyLanguage(language);
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    } catch {
      // ignore
    }
  }, [language]);

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next);
  }, []);

  const currentMeta = useMemo<LanguageMeta>(() => {
    return SUPPORTED_LANGUAGES.find((l) => l.code === language) ?? defaultMeta;
  }, [language]);

  const t = useCallback(
    (key: string, fallback?: string): string => {
      const activeDict = TRANSLATIONS[language];
      if (activeDict && key in activeDict) {
        return activeDict[key]!;
      }
      return TRANSLATIONS.en[key] ?? fallback ?? key;
    },
    [language],
  );

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      currentMeta,
      setLanguage,
      t,
      languages: SUPPORTED_LANGUAGES,
    }),
    [language, currentMeta, setLanguage, t],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  return useContext(LanguageContext);
}
