
export interface TextbookSection {
  title: string;
  content: string;
  isGenerating?: boolean;
}

export interface TextbookChapter {
  title: string;
  sections: TextbookSection[];
  isGenerating?: boolean;
}

export interface Textbook {
  title: string;
  description?: string;
  chapters: TextbookChapter[];
  completionPercentage?: number;
  status?: 'generating' | 'completed' | 'error';
  currentlyGenerating?: {
    chapterIndex?: number;
    sectionIndex?: number;
    chapterTitle?: string;
    sectionTitle?: string;
  };
  estimatedTimeRemaining?: number; // in seconds
}
