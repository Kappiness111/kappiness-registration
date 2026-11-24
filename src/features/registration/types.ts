import type { ChangeEvent } from 'react';
import type { FieldErrors, RegistrationValues } from '@shared/registration.ts';
import { todayLocal } from '../../lib/format';

export type StringKey = {
  [K in keyof RegistrationValues]: RegistrationValues[K] extends string ? K : never;
}[keyof RegistrationValues];

export interface Bound {
  id: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  error?: string;
}

export interface StepProps {
  values: RegistrationValues;
  errors: FieldErrors;
  setField: <K extends keyof RegistrationValues>(key: K, value: RegistrationValues[K]) => void;
  bind: (key: StringKey) => Bound;
}

export function createInitialValues(): RegistrationValues {
  return {
    fullName: '',
    dateOfBirth: '',
    gender: '',
    genderOther: '',
    mobilePhone: '',
    email: '',
    presentAddress: '',
    presentPincode: '',
    permanentSameAsPresent: true,
    permanentAddress: '',
    permanentPincode: '',
    maritalStatus: '',
    educationalLevel: '',
    occupation: '',
    emergencyName: '',
    emergencyRelationship: '',
    emergencyNumber: '',
    previouslyRegistered: '',
    referralSource: '',
    referralOther: '',
    psychologicalConsent: false,
    researchPermission: '',
    signatureMethod: 'checkbox',
    signatureTyped: '',
    signatureDrawn: '',
    consentDate: todayLocal(),
  };
}

/** Malayalam labels as printed on the clinic's paper form. */
export const ML = {
  fullName: 'മുഴുവൻ പേര്',
  dateOfBirth: 'ജനന തീയതി',
  age: 'വയസ്സ്',
  gender: 'ജെൻഡർ',
  mobilePhone: 'ഫോൺ',
  email: 'ഇമെയിൽ ഐഡി',
  presentAddress: 'ഇപ്പോഴത്തെ മേൽവിലാസം പിൻകോഡ് സഹിതം',
  permanentAddress: 'സ്ഥിരം മേൽവിലാസം പിൻകോഡ് സഹിതം',
  maritalStatus: 'വൈവാഹിക നില',
  educationalLevel: 'വിദ്യാഭ്യാസ യോഗ്യത',
  occupation: 'തൊഴിൽ',
  emergency: 'എമർജൻസി',
  emergencyName: 'പേര്',
  emergencyRelationship: 'ബന്ധം',
  emergencyNumber: 'ബന്ധപ്പെടേണ്ട നമ്പർ',
  previouslyRegistered: 'നിങ്ങൾ ഇതിനു മുൻപ് കാപ്പിനെസ്സിൽ രജിസ്റ്റർ ചെയ്തിട്ടുണ്ടോ?',
  referral: 'നിങ്ങൾ എങ്ങനെയാണ് കാപ്പിനെസ്സിനെ കുറിച്ച് അറിഞ്ഞത്?',
} as const;
