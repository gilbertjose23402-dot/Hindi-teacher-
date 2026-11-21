/**
 * Criminal-court vocabulary in English, Hindi and Marathi (as used in
 * Maharashtra courts). Added to flashcards on request as the "legal" deck.
 */
export interface LegalTerm {
  en: string
  hi: string
  mr: string
}

export const LEGAL_TERMS: LegalTerm[] = [
  { en: 'bail', hi: 'ज़मानत', mr: 'जामीन' },
  { en: 'anticipatory bail', hi: 'अग्रिम ज़मानत', mr: 'अटकपूर्व जामीन' },
  { en: 'FIR (first information report)', hi: 'प्राथमिकी (एफ़आईआर)', mr: 'प्रथम खबरी अहवाल (एफआयआर)' },
  { en: 'chargesheet', hi: 'आरोप पत्र', mr: 'दोषारोपपत्र' },
  { en: 'accused', hi: 'अभियुक्त / आरोपी', mr: 'आरोपी' },
  { en: 'complainant', hi: 'शिकायतकर्ता', mr: 'फिर्यादी' },
  { en: 'complaint', hi: 'शिकायत', mr: 'फिर्याद' },
  { en: 'witness', hi: 'गवाह', mr: 'साक्षीदार' },
  { en: 'cross-examination', hi: 'जिरह', mr: 'उलटतपासणी' },
  { en: 'hearing', hi: 'सुनवाई', mr: 'सुनावणी' },
  { en: 'adjournment', hi: 'स्थगन', mr: 'तहकूब' },
  { en: 'judgment / verdict', hi: 'फ़ैसला / निर्णय', mr: 'निकाल' },
  { en: 'client', hi: 'मुवक्किल', mr: 'अशील' },
  { en: 'police custody', hi: 'पुलिस हिरासत', mr: 'पोलीस कोठडी' },
  { en: 'judicial custody', hi: 'न्यायिक हिरासत', mr: 'न्यायालयीन कोठडी' },
  { en: 'surety (person)', hi: 'ज़मानतदार', mr: 'जामीनदार' },
  { en: 'evidence', hi: 'सबूत / साक्ष्य', mr: 'पुरावा' },
  { en: 'public prosecutor', hi: 'लोक अभियोजक / सरकारी वकील', mr: 'सरकारी वकील' },
  { en: 'defence (side)', hi: 'बचाव पक्ष', mr: 'बचाव पक्ष' },
  { en: 'arrest', hi: 'गिरफ़्तारी', mr: 'अटक' },
  { en: 'summons', hi: 'समन', mr: 'समन्स' },
  { en: 'acquittal', hi: 'दोषमुक्ति', mr: 'निर्दोष मुक्तता' },
  { en: 'conviction', hi: 'दोषसिद्धि', mr: 'दोषसिद्धी' },
  { en: 'sentence (punishment)', hi: 'सज़ा', mr: 'शिक्षा' },
  { en: 'appeal', hi: 'अपील', mr: 'अपील' },
  { en: 'affidavit', hi: 'हलफ़नामा / शपथ पत्र', mr: 'प्रतिज्ञापत्र' },
  { en: 'vakalatnama', hi: 'वकालतनामा', mr: 'वकीलपत्र' },
  { en: 'next date (of hearing)', hi: 'अगली तारीख', mr: 'पुढची तारीख' },
]
