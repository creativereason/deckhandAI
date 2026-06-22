export interface ExperienceEntry {
  company: string;
  role: string;
  start: string;
  end: string | null;
  bullets: string[];
}

export interface EducationEntry {
  institution: string;
  degree: string;
  graduated: string;
  honors?: string;
}

export interface Profile {
  name?: string;
  title?: string;
  summary?: string;
  strengths?: string[];
  experience?: ExperienceEntry[];
  education?: EducationEntry[];
  writing_rules?: string[];
  portfolio_url?: string;
  portfolio_password?: string;
}
