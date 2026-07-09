// Small reference sets for the clinical pickers (front-end only for the MVP).

export const ICD10 = [
  { code: "Z00.00", description: "General adult medical exam, no abnormal findings" },
  { code: "I10", description: "Essential (primary) hypertension" },
  { code: "E11.9", description: "Type 2 diabetes mellitus without complications" },
  { code: "J06.9", description: "Acute upper respiratory infection, unspecified" },
  { code: "J45.909", description: "Unspecified asthma, uncomplicated" },
  { code: "M54.5", description: "Low back pain" },
  { code: "R51.9", description: "Headache, unspecified" },
  { code: "K21.9", description: "GERD without esophagitis" },
  { code: "R05.9", description: "Cough, unspecified" },
  { code: "N39.0", description: "Urinary tract infection, site not specified" },
  { code: "R07.9", description: "Chest pain, unspecified" },
  { code: "J02.9", description: "Acute pharyngitis, unspecified" },
];

export const LABS = [
  "Complete Blood Count (CBC)",
  "Basic Metabolic Panel (BMP)",
  "Comprehensive Metabolic Panel (CMP)",
  "Lipid Panel",
  "Hemoglobin A1c",
  "Thyroid Stimulating Hormone (TSH)",
  "Urinalysis",
  "COVID-19 PCR",
];

export const IMAGING = [
  "Chest X-ray",
  "Electrocardiogram (ECG)",
  "Echocardiogram",
  "CT Head without contrast",
  "MRI Lumbar Spine",
  "Abdominal Ultrasound",
];

export const DRUGS = [
  { name: "Amoxicillin", dose: "500 mg", frequency: "3x daily" },
  { name: "Lisinopril", dose: "10 mg", frequency: "Daily" },
  { name: "Metformin", dose: "500 mg", frequency: "2x daily" },
  { name: "Atorvastatin", dose: "20 mg", frequency: "Nightly" },
  { name: "Ibuprofen", dose: "400 mg", frequency: "Every 6h as needed" },
  { name: "Albuterol HFA inhaler", dose: "2 puffs", frequency: "Every 4-6h as needed" },
  { name: "Omeprazole", dose: "20 mg", frequency: "Daily before breakfast" },
  { name: "Amlodipine", dose: "5 mg", frequency: "Daily" },
];
