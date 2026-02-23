/** ArXiv paper metadata */
export interface Paper {
  id: string;
  title: string;
  authors: string[];
  summary: string;
  published: string;
  updated: string;
  categories: string[];
  pdfUrl: string;
  arxivUrl: string;
}

/** Saved paper in reading list */
export interface SavedPaper extends Paper {
  savedAt: number;
  notes?: string;
  tags?: string[];
  read: boolean;
}

/** Search result from arXiv API */
export interface SearchResult {
  papers: Paper[];
  totalResults: number;
  query: string;
}
