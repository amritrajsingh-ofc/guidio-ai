/**
 * Fields of study and the suggestions shown for each one.
 *
 * Suggestions only save typing. Every input still accepts any text, and the
 * chosen field is never sent to the server: it is a helper for this screen.
 * When a saved profile is opened again, the field is guessed from the
 * degree, specialisation and target role (see inferFieldId).
 */

export const OTHER_FIELD_ID = "other";

export const FIELD_OPTIONS = [
  {
    id: "engineering-technology",
    label: "Engineering and Technology",
    showLanguages: true,
    keywords: [
      "b tech", "btech", "b e", "m tech", "mtech", "bca", "mca",
      "engineering", "engineer", "computer science", "information technology",
      "software", "developer", "data science", "polytechnic",
    ],
    degrees: ["B.Tech", "B.E.", "BCA", "B.Sc (IT)", "Diploma in Engineering", "M.Tech", "MCA"],
    branches: [
      "Computer Science", "Information Technology", "Electronics", "Mechanical",
      "Civil", "Electrical", "Data Science", "Artificial Intelligence",
    ],
    skills: [
      "Data Structures", "Algorithms", "HTML", "CSS", "React", "Node.js", "Git",
      "SQL", "AutoCAD", "Circuit Design", "Machine Learning", "Communication",
    ],
    interests: [
      "Web Development", "Artificial Intelligence", "Data Science", "Cybersecurity",
      "Cloud Computing", "Embedded Systems", "Robotics", "Renewable Energy",
    ],
    roles: [
      "Frontend Developer", "Backend Developer", "Software Engineer", "Data Analyst",
      "Mechanical Design Engineer", "Civil Site Engineer", "Electrical Engineer",
      "Cybersecurity Analyst",
    ],
  },
  {
    id: "medical-healthcare",
    label: "Medical and Healthcare",
    showLanguages: false,
    keywords: [
      "mbbs", "bds", "bams", "bhms", "b pharm", "m pharm", "nursing", "bpt",
      "physiotherapy", "medical", "medicine", "pharmacy", "dental", "healthcare",
      "public health", "nurse", "doctor",
    ],
    degrees: ["MBBS", "BDS", "B.Pharm", "B.Sc Nursing", "BPT", "BAMS", "BHMS", "MD / MS", "M.Pharm"],
    branches: [
      "General Medicine", "Dentistry", "Pharmacy", "Nursing", "Physiotherapy",
      "Public Health", "Medical Laboratory Technology", "Nutrition and Dietetics",
    ],
    skills: [
      "Patient Communication", "Clinical Examination", "Anatomy and Physiology",
      "Basic Life Support", "Medical Records", "Pharmacology", "Infection Control",
      "Research Methods",
    ],
    interests: [
      "Clinical Practice", "Public Health", "Medical Research", "Mental Health",
      "Community Health", "Healthcare Management",
    ],
    roles: [
      "Medical Officer", "Staff Nurse", "Clinical Pharmacist", "Physiotherapist",
      "Public Health Officer", "Medical Laboratory Technologist",
      "Clinical Research Associate", "Dentist",
    ],
  },
  {
    id: "commerce-finance",
    label: "Commerce and Finance",
    showLanguages: false,
    keywords: [
      "b com", "m com", "bcom", "mcom", "commerce", "accounting", "accountancy",
      "finance", "banking", "taxation", "economics", "chartered accountant",
      "cma", "cfa", "auditor", "audit",
    ],
    degrees: ["B.Com", "B.Com (Hons)", "M.Com", "CA", "CMA", "CFA", "B.A. Economics"],
    branches: [
      "Accounting", "Taxation", "Banking", "Finance", "Economics", "Auditing",
      "Financial Markets", "Insurance",
    ],
    skills: [
      "Financial Accounting", "Excel", "Tally", "Taxation", "Auditing",
      "Financial Analysis", "Bookkeeping", "Business Communication",
    ],
    interests: [
      "Investment Banking", "Financial Markets", "Taxation", "Auditing", "Banking",
      "Fintech",
    ],
    roles: [
      "Accountant", "Financial Analyst", "Auditor", "Tax Consultant",
      "Investment Banking Analyst", "Bank Probationary Officer", "Credit Analyst",
      "Equity Research Analyst",
    ],
  },
  {
    id: "arts-humanities",
    label: "Arts and Humanities",
    showLanguages: false,
    keywords: [
      "b a", "m a", "arts", "humanities", "english literature", "history",
      "political science", "psychology", "sociology", "philosophy", "journalism",
      "mass communication", "bjmc", "literature", "linguistics",
    ],
    degrees: ["B.A.", "B.A. (Hons)", "M.A.", "BJMC", "M.A. Psychology", "Diploma"],
    branches: [
      "English Literature", "History", "Political Science", "Psychology", "Sociology",
      "Journalism and Mass Communication", "Philosophy", "Languages",
    ],
    skills: [
      "Research and Writing", "Critical Thinking", "Public Speaking", "Content Writing",
      "Editing", "Translation", "Presentation", "Interviewing",
    ],
    interests: [
      "Writing", "Journalism", "Policy and Society", "Culture and Media", "Psychology",
      "Teaching", "Publishing",
    ],
    roles: [
      "Content Writer", "Journalist", "Editor", "Research Associate", "Counsellor",
      "Policy Analyst", "Translator", "Social Researcher",
    ],
  },
  {
    id: "law",
    label: "Law",
    showLanguages: false,
    keywords: [
      "llb", "llm", "ba llb", "bba llb", "law", "legal", "lawyer", "advocate",
      "judiciary", "corporate law", "criminal law",
    ],
    degrees: ["LLB", "B.A. LLB", "BBA LLB", "B.Com LLB", "LLM"],
    branches: [
      "Corporate Law", "Criminal Law", "Constitutional Law", "Intellectual Property Law",
      "Civil Law", "Taxation Law", "International Law", "Family Law",
    ],
    skills: [
      "Legal Research", "Legal Drafting", "Case Analysis", "Moot Court", "Contract Law",
      "Negotiation", "Public Speaking", "Legal Writing",
    ],
    interests: [
      "Corporate Law", "Litigation", "Human Rights", "Intellectual Property",
      "Arbitration", "Judicial Services",
    ],
    roles: [
      "Corporate Lawyer", "Litigation Associate", "Legal Advisor", "Legal Researcher",
      "Compliance Officer", "Judicial Services Aspirant", "Company Secretary",
    ],
  },
  {
    id: "management-business",
    label: "Management and Business",
    showLanguages: false,
    keywords: [
      "bba", "mba", "pgdm", "bms", "management", "marketing", "human resources",
      "entrepreneurship", "business", "operations", "supply chain",
    ],
    degrees: ["BBA", "BMS", "MBA", "PGDM", "B.Com (Management)"],
    branches: [
      "Marketing", "Human Resources", "Finance", "Operations", "Entrepreneurship",
      "International Business", "Business Analytics", "Supply Chain",
    ],
    skills: [
      "Leadership", "Project Management", "Market Research", "Excel", "Negotiation",
      "Business Communication", "Presentation", "Data Analysis",
    ],
    interests: [
      "Marketing", "Entrepreneurship", "Consulting", "Human Resources", "Operations",
      "Product Management",
    ],
    roles: [
      "Marketing Executive", "HR Executive", "Business Analyst", "Operations Manager",
      "Management Trainee", "Product Manager", "Sales Executive", "Entrepreneur",
    ],
  },
  {
    id: "science-research",
    label: "Science and Research",
    showLanguages: true,
    keywords: [
      "b sc", "m sc", "bsc", "msc", "phd", "ph d", "physics", "chemistry",
      "mathematics", "biology", "biotechnology", "microbiology", "statistics",
      "research", "scientist",
    ],
    degrees: ["B.Sc", "M.Sc", "Ph.D", "Integrated M.Sc", "BS-MS"],
    branches: [
      "Physics", "Chemistry", "Mathematics", "Biology", "Biotechnology",
      "Environmental Science", "Statistics", "Microbiology",
    ],
    skills: [
      "Laboratory Techniques", "Data Analysis", "Scientific Writing", "Research Methods",
      "Statistics", "Lab Safety", "Critical Thinking", "Python",
    ],
    interests: [
      "Research", "Biotechnology", "Environment and Climate", "Space Science",
      "Materials Science", "Data Analysis",
    ],
    roles: [
      "Research Associate", "Laboratory Technician", "Data Analyst",
      "Quality Control Analyst", "Research Scientist", "Environmental Consultant",
      "Biotechnologist",
    ],
  },
  {
    id: "design-creative",
    label: "Design and Creative Arts",
    showLanguages: false,
    keywords: [
      "b des", "m des", "bfa", "mfa", "design", "designer", "animation", "fashion",
      "fine arts", "graphic", "film", "photography", "ui ux",
    ],
    degrees: ["B.Des", "M.Des", "BFA", "MFA", "B.Sc Animation", "Diploma in Design"],
    branches: [
      "Graphic Design", "UI/UX Design", "Fashion Design", "Industrial Design",
      "Animation", "Interior Design", "Film and Media", "Photography",
    ],
    skills: [
      "Typography", "Adobe Photoshop", "Adobe Illustrator", "Figma", "Sketching",
      "Portfolio Building", "Colour Theory", "Video Editing",
    ],
    interests: [
      "Branding", "UI/UX Design", "Animation", "Fashion", "Film Making", "Photography",
      "Illustration",
    ],
    roles: [
      "Graphic Designer", "UI/UX Designer", "Fashion Designer", "Animator",
      "Art Director", "Video Editor", "Product Designer", "Illustrator",
    ],
  },
  {
    id: "architecture",
    label: "Architecture",
    showLanguages: false,
    keywords: [
      "b arch", "m arch", "barch", "march", "architecture", "architect",
      "urban planning", "landscape", "b planning",
    ],
    degrees: ["B.Arch", "M.Arch", "B.Planning", "Diploma in Architecture"],
    branches: [
      "Architectural Design", "Urban Planning", "Landscape Architecture",
      "Sustainable Design", "Interior Architecture", "Construction Management",
    ],
    skills: [
      "AutoCAD", "Revit", "SketchUp", "Architectural Drawing", "3D Modelling",
      "Building Codes", "Site Analysis", "Model Making",
    ],
    interests: [
      "Sustainable Design", "Urban Planning", "Heritage Conservation", "Interior Design",
      "Landscape Design", "Smart Cities",
    ],
    roles: [
      "Architect", "Urban Planner", "Interior Designer", "Landscape Architect",
      "BIM Modeller", "Project Architect", "Architectural Assistant",
    ],
  },
  {
    id: "education-teaching",
    label: "Education and Teaching",
    showLanguages: false,
    keywords: [
      "b ed", "m ed", "d el ed", "b el ed", "bed", "med", "teaching", "teacher",
      "education", "pedagogy", "special education", "ntt",
    ],
    degrees: ["B.Ed", "M.Ed", "D.El.Ed", "B.El.Ed", "NTT", "Integrated B.A. B.Ed"],
    branches: [
      "Primary Education", "Secondary Education", "Special Education",
      "Early Childhood Education", "Educational Technology", "Curriculum Design",
      "Physical Education", "Mathematics Teaching",
    ],
    skills: [
      "Lesson Planning", "Classroom Management", "Curriculum Design", "Student Assessment",
      "Communication", "Educational Technology", "Public Speaking", "Mentoring",
    ],
    interests: [
      "Pedagogy", "Special Education", "Educational Technology", "Child Psychology",
      "Curriculum Design", "Learning Assessment",
    ],
    roles: [
      "Primary School Teacher", "Secondary School Teacher", "Special Educator",
      "Instructional Designer", "Academic Counsellor", "Education Coordinator",
      "Lecturer", "Online Tutor",
    ],
  },
  {
    id: "government-competitive",
    label: "Government and Competitive Exams",
    showLanguages: false,
    keywords: [
      "upsc", "civil services", "ias", "ssc", "psc", "banking exam", "railway exam",
      "defence", "nda", "government", "competitive exam", "competitive exams",
      "public administration",
    ],
    degrees: ["Any graduation", "B.A.", "B.Sc", "B.Com", "B.Tech", "LLB"],
    branches: [
      "Civil Services Preparation", "State Public Service Commission", "SSC Exams",
      "Banking Exams", "Railway Exams", "Defence Services", "Teaching Eligibility Exams",
      "Judicial Services Exams",
    ],
    skills: [
      "General Studies", "Current Affairs", "Quantitative Aptitude", "Reasoning",
      "Answer Writing", "Essay Writing", "Time Management", "Mock Test Practice",
    ],
    interests: [
      "Public Administration", "Policy and Governance", "Banking and Finance",
      "Defence Services", "Economy and Current Affairs", "Public Service",
    ],
    roles: [
      "Civil Services Officer", "Bank Probationary Officer", "SSC Graduate Level Officer",
      "State Government Officer", "Defence Officer", "Government Teacher",
      "Judicial Services Officer",
    ],
  },
  {
    id: "vocational-professional",
    label: "Vocational and Professional Education",
    showLanguages: false,
    keywords: [
      "iti", "diploma", "certificate", "apprenticeship", "vocational", "hospitality",
      "hotel management", "electrician", "technician", "welding", "culinary",
    ],
    degrees: ["ITI", "Polytechnic Diploma", "Certificate Course", "Apprenticeship", "Hotel Management Diploma"],
    branches: [
      "Electrician", "Fitter", "Welding", "Hospitality and Hotel Management",
      "Automotive Technology", "Beauty and Wellness", "Culinary Arts", "Computer Hardware",
    ],
    skills: [
      "Safety Practices", "Equipment Handling", "Customer Service", "Technical Drawing Reading",
      "Quality Checking", "Basic Computer Skills", "Teamwork", "Tools and Machinery",
    ],
    interests: [
      "Skilled Trades", "Hospitality", "Automotive", "Self-Employment", "Retail",
      "Healthcare Support",
    ],
    roles: [
      "Electrician", "Technician", "Hotel Operations Trainee", "Chef", "Welder",
      "Automobile Technician", "Beautician", "Supervisor",
    ],
  },
  {
    id: OTHER_FIELD_ID,
    label: "Other or Interdisciplinary",
    showLanguages: true,
    keywords: [],
    degrees: ["B.A.", "B.Sc", "B.Com", "M.A.", "M.Sc", "Diploma", "Certificate"],
    branches: [
      "Interdisciplinary Studies", "Liberal Arts", "Public Policy", "Environmental Studies",
      "Cognitive Science", "Sports Science", "Agriculture", "Social Work",
    ],
    skills: [
      "Communication", "Teamwork", "Research", "Problem Solving", "Critical Thinking",
      "Time Management", "Presentation", "Digital Literacy",
    ],
    interests: [
      "Social Impact", "Entrepreneurship", "Sustainability", "Research", "Community Work",
      "Technology and Society",
    ],
    roles: [
      "Project Coordinator", "Research Assistant", "Operations Associate", "Program Officer",
      "Analyst", "Consultant", "Entrepreneur", "Management Trainee",
    ],
  },
];

const FIELD_BY_ID = new Map(FIELD_OPTIONS.map((field) => [field.id, field]));
const GENERAL_FIELD = FIELD_BY_ID.get(OTHER_FIELD_ID);

/** The field for an id. An empty or unknown id gives the general field. */
export function getFieldProfile(fieldId) {
  return FIELD_BY_ID.get(fieldId) ?? GENERAL_FIELD;
}

/** Lowercase words only, so "B.Tech" and "b tech" compare equal. */
function normaliseText(value) {
  return ` ${String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()} `;
}

/**
 * Guesses the field from the saved degree, specialisation and target role.
 * Returns "" when nothing matches, which shows the general suggestions.
 * When two fields match equally, the one listed first wins.
 */
export function inferFieldId({ degree = "", branch = "", targetRole = "" } = {}) {
  const text = normaliseText(`${degree} ${branch} ${targetRole}`);

  let bestId = "";
  let bestScore = 0;

  for (const field of FIELD_OPTIONS) {
    let score = 0;

    for (const keyword of field.keywords) {
      if (text.includes(normaliseText(keyword))) score += 1;
    }

    if (score > bestScore) {
      bestScore = score;
      bestId = field.id;
    }
  }

  return bestId;
}