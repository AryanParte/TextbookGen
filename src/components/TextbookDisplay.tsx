import { useState } from 'react';
import { Textbook } from '@/types/textbook';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChevronLeft, ChevronRight, Book, AlertCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

interface TextbookDisplayProps {
  textbook: Textbook;
  onReset: () => void;
}

const TextbookDisplay: React.FC<TextbookDisplayProps> = ({
  textbook,
  onReset
}) => {
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const { toast } = useToast();
  const currentChapter = textbook.chapters[currentChapterIndex];

  const navigateToPreviousChapter = () => {
    if (currentChapterIndex > 0) {
      setCurrentChapterIndex(currentChapterIndex - 1);
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    }
  };

  const navigateToNextChapter = () => {
    if (currentChapterIndex < textbook.chapters.length - 1) {
      setCurrentChapterIndex(currentChapterIndex + 1);
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    }
  };

  const formatContent = (content: string) => {
    // Remove duplicate chapter titles
    let formattedContent = content.replace(/^Chapter \d+: Chapter \d+:/, 'Chapter:');

    // Handle markdown headers (including ## headers)
    formattedContent = formattedContent
      .replace(/^## (.*$)/gm, '<h3 class="text-xl font-serif font-semibold mb-4 mt-6 text-textbook">$1</h3>')
      .replace(/^### (.*$)/gm, '<h4 class="text-lg font-semibold mt-6 mb-3">$1</h4>')
      .replace(/^#### (.*$)/gm, '<h5 class="text-base font-medium mt-4 mb-2">$1</h5>');

    // Format mathematical expressions
    formattedContent = formattedContent
      // Replace LaTeX array environments with HTML tables
      .replace(/\\begin\{array\}(\{.*?\})([\s\S]*?)\\end\{array\}/g, (match, alignment, content) => {
        const rows = content.trim().split('\\\\');
        let tableHTML = '<table class="my-4 mx-auto border-collapse"><tbody>';
        rows.forEach(row => {
          if (row.trim()) {
            tableHTML += '<tr>';
            const cells = row.split('&');
            cells.forEach(cell => {
              tableHTML += `<td class="px-2 py-1">${cell.trim()}</td>`;
            });
            tableHTML += '</tr>';
          }
        });
        tableHTML += '</tbody></table>';
        return tableHTML;
      })
      // Format subscripts with underscore
      .replace(/([a-zA-Z])_(\{[^}]+\}|[a-zA-Z0-9])/g, '$1<sub>$2</sub>')
      // Format superscripts with caret
      .replace(/\^(\{[^}]+\}|[a-zA-Z0-9])/g, '<sup>$1</sup>')
      // Display block equations
      .replace(/\\\[([\s\S]*?)\\\]/g, '<div class="my-4 text-center tex-math">$1</div>')
      // Display inline equations
      .replace(/\\\(([\s\S]*?)\\\)/g, '<span class="tex-math">$1</span>')
      // Format basic LaTeX commands
      .replace(/\\quad/g, '&nbsp;&nbsp;&nbsp;&nbsp;')
      .replace(/\\ldots/g, '&hellip;')
      .replace(/\\hline/g, '<hr class="my-1">')
      // Format aligned equations
      .replace(/\\begin\{align\*\}([\s\S]*?)\\end\{align\*\}/g, (match, content) => {
        const lines = content.trim().split('\\\\');
        let alignedHTML = '<div class="my-4 tex-math">';
        lines.forEach(line => {
          if (line.trim()) {
            // Handle alignment with & symbol
            const parts = line.split('&');
            alignedHTML += `<div class="flex items-baseline">${parts.join('<span class="mx-2">=</span>')}</div>`;
          }
        });
        alignedHTML += '</div>';
        return alignedHTML;
      })
      // Convert bold text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      // Convert line breaks
      .replace(/\n\n/g, '<br/><br/>')
      .replace(/\n(?!\<)/g, '<br/>');

    return formattedContent;
  };
  
  // Function to strip HTML tags for PDF content
  const stripHtml = (html: string) => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.body.textContent || "";
  };

  const generatePDF = async () => {
    setIsGeneratingPDF(true);
    
    try {
      // Create a new PDF document with better margins
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        putOnlyUsedFonts: true,
        floatPrecision: 16
      });

      // Set default font
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(12);

      // Helper function to add text with proper spacing
      const addTextWithSpacing = (text: string, x: number, y: number, options: { maxWidth?: number, lineHeight?: number } = {}) => {
        const { maxWidth = 170, lineHeight = 7 } = options;
        const lines = pdf.splitTextToSize(text, maxWidth);
        pdf.text(lines, x, y);
        return y + (lines.length * lineHeight);
      };

      // Helper function to add a new page if needed
      const checkNewPage = (y: number) => {
        if (y > 270) {
          pdf.addPage();
          return 20;
        }
        return y;
      };

      // Add title page
      pdf.setFontSize(24);
      pdf.setFont("helvetica", "bold");
      let yPos = 30;
      pdf.text(textbook.title, 20, yPos);
      
      // Add description if exists
      if (textbook.description) {
        pdf.setFontSize(12);
        pdf.setFont("helvetica", "normal");
        yPos = addTextWithSpacing(textbook.description, 20, yPos + 15, { lineHeight: 6 });
      }
      
      // Table of Contents
      pdf.addPage();
      yPos = 20;
      
      pdf.setFontSize(18);
      pdf.setFont("helvetica", "bold");
      pdf.text("Table of Contents", 20, yPos);
      
      pdf.setFontSize(12);
      pdf.setFont("helvetica", "normal");
      yPos += 15;
      
      // Add chapters to TOC with proper spacing
      textbook.chapters.forEach((chapter, index) => {
        yPos = checkNewPage(yPos);
        
        const chapterText = `Chapter ${index + 1}: ${chapter.title}`;
        const pageNum = index + 3; // First page is title, second is TOC
        
        pdf.text(chapterText, 20, yPos);
        pdf.text(`Page ${pageNum}`, 150, yPos);
        yPos += 10;
      });
      
      // Add chapters content with better formatting
      textbook.chapters.forEach((chapter) => {
        pdf.addPage();
        yPos = 20;
        
        // Chapter title
        pdf.setFontSize(20);
        pdf.setFont("helvetica", "bold");
        yPos = addTextWithSpacing(`Chapter: ${chapter.title}`, 20, yPos, { lineHeight: 8 });
        yPos += 10;
        
        // Add sections with proper spacing
        chapter.sections.forEach((section) => {
          if (section.isGenerating) return;
          
          yPos = checkNewPage(yPos);
          
          // Section title
          pdf.setFontSize(16);
          pdf.setFont("helvetica", "bold");
          yPos = addTextWithSpacing(section.title, 20, yPos, { lineHeight: 7 });
          yPos += 5;
          
          // Section content
          pdf.setFontSize(12);
          pdf.setFont("helvetica", "normal");
          
          // Clean and format the content
          const cleanedContent = stripHtml(formatContent(section.content))
            .replace(/\n\s*\n/g, '\n') // Remove multiple newlines
            .replace(/\s+/g, ' ') // Normalize whitespace
            .trim();
          
          yPos = addTextWithSpacing(cleanedContent, 20, yPos, { lineHeight: 6 });
          yPos += 10; // Add extra space between sections
        });
      });
      
      // Generate filename from textbook title
      const filename = textbook.title.toLowerCase().replace(/\s+/g, '_') + '.pdf';
      
      // Save the PDF
      pdf.save(filename);
      
      toast({
        title: "PDF Generated Successfully",
        description: `Your textbook "${textbook.title}" has been downloaded.`,
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: "PDF Generation Failed",
        description: "There was an error generating your PDF. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  // Function to render section content with loading state
  const renderSectionContent = (section: any) => {
    if (section.isGenerating) {
      return (
        <div className="mt-4 space-y-4">
          <div className="flex items-center gap-2 text-amber-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm font-medium">Content generating...</span>
          </div>
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      );
    }
    
    return (
      <div 
        dangerouslySetInnerHTML={{__html: formatContent(section.content)}} 
        className="prose prose-sm max-w-none [&_.tex-math]:font-serif [&_.tex-math]:text-lg" 
      />
    );
  };

  return <div className="w-full max-w-5xl mx-auto bg-white shadow-lg rounded-lg overflow-hidden">
      {/* Textbook Header */}
      <div className="bg-textbook p-6 text-white">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl md:text-3xl font-serif font-bold bg-gradient-to-r from-white to-blue-100 text-transparent bg-clip-text">{textbook.title}</h1>
            {textbook.description && <p className="mt-2 text-sm md:text-base opacity-90">{textbook.description}</p>}
          </div>
        </div>
        
        <div className="flex flex-wrap gap-3 mt-4">
          <Button variant="outline" size="sm" onClick={onReset} className="text-sm hover:bg-white text-slate-950">
            <Book className="mr-2 h-4 w-4" />
            Generate New Textbook
          </Button>
        </div>
      </div>
      
      {/* Textbook Content Layout */}
      <div className="flex flex-col md:flex-row">
        {/* Chapter Navigation */}
        <div className="w-full md:w-64 bg-gray-50 border-r border-gray-200">
          <ScrollArea className="h-[70vh]">
            <div className="p-4">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold font-serif text-textbook">Table of Contents</h2>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={generatePDF}
                  disabled={isGeneratingPDF}
                  className="text-sm p-2"
                >
                  {isGeneratingPDF ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                  )}
                </Button>
              </div>
              <ul>
                {textbook.chapters.map((chapter, index) => (
                  <li key={index}>
                    <button 
                      onClick={() => setCurrentChapterIndex(index)} 
                      className={`w-full text-left px-3 py-2 rounded text-sm hover:bg-blue-50 transition-colors ${currentChapterIndex === index ? 'chapter-active' : ''}`}
                    >
                      <div className="flex items-center justify-between">
                        <span>{index + 1}. {chapter.title}</span>
                        {chapter.isGenerating && <Loader2 className="h-3 w-3 animate-spin text-amber-500" />}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </ScrollArea>
        </div>
        
        {/* Chapter Content */}
        <div className="flex-1 p-6">
          <ScrollArea className="h-[70vh]">
            <div className="textbook-content pr-4">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-serif font-bold mb-6 bg-gradient-to-r from-textbook to-blue-500 text-transparent bg-clip-text">
                  Chapter {currentChapterIndex + 1}: {currentChapter.title}
                </h2>
              </div>
              
              {currentChapter.sections.map((section, index) => (
                <div key={index} className="mb-8">
                  <h3 className="text-xl font-serif font-semibold mb-4 bg-gradient-to-r from-textbook to-blue-400 text-transparent bg-clip-text flex items-center gap-2">
                    {section.title}
                  </h3>
                  {renderSectionContent(section)}
                </div>
              ))}
            </div>
          </ScrollArea>
          
          {/* Chapter Navigation Controls */}
          <div className="flex justify-between items-center mt-6 pt-4 border-t border-gray-200">
            <Button variant="outline" onClick={navigateToPreviousChapter} disabled={currentChapterIndex === 0} className="text-sm">
              <ChevronLeft className="mr-1 h-4 w-4" />
              Previous Chapter
            </Button>
            
            <span className="text-sm text-gray-500">
              Chapter {currentChapterIndex + 1} of {textbook.chapters.length}
            </span>
            
            <Button variant="outline" onClick={navigateToNextChapter} disabled={currentChapterIndex === textbook.chapters.length - 1} className="text-sm">
              Next Chapter
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>;
};

export default TextbookDisplay;
