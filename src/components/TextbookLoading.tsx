
import { Book, Clock, FileText } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface TextbookLoadingProps {
  error?: boolean;
  completionPercentage?: number;
  currentlyGenerating?: {
    chapterIndex?: number;
    sectionIndex?: number;
    chapterTitle?: string;
    sectionTitle?: string;
  };
  estimatedTimeRemaining?: number;
  onSkipWaiting?: () => void;
}

const TextbookLoading = ({ 
  error, 
  completionPercentage = 0,
  currentlyGenerating,
  estimatedTimeRemaining,
  onSkipWaiting
}: TextbookLoadingProps) => {
  // Format estimated time remaining into minutes and seconds
  const formatTimeRemaining = () => {
    if (!estimatedTimeRemaining) return "Calculating...";
    
    const minutes = Math.floor(estimatedTimeRemaining / 60);
    const seconds = Math.floor(estimatedTimeRemaining % 60);
    
    if (minutes > 0) {
      return `~${minutes}m ${seconds}s remaining`;
    } else {
      return `~${seconds}s remaining`;
    }
  };

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-lg mx-auto mt-16 p-8 text-center">
      <div className="relative">
        <Book size={64} className={`${error ? 'text-red-500' : 'text-textbook'} ${!error && 'animate-pulse'}`} />
      </div>
      <h2 className={`text-2xl font-serif font-bold mt-6 mb-3 ${error ? 'text-red-500' : 'text-textbook'}`}>
        {error ? 'Error Generating Textbook' : 'Generating Your Textbook'}
      </h2>
      
      {!error && (
        <div className="w-full max-w-md mb-4">
          {completionPercentage > 0 && (
            <>
              <Progress value={completionPercentage} className="h-2 mb-2" />
              <p className="text-sm text-muted-foreground">
                {completionPercentage}% complete
              </p>
            </>
          )}
          
          {currentlyGenerating && (
            <div className="mt-4 border border-blue-100 dark:border-blue-900 rounded-lg p-4 bg-blue-50 dark:bg-blue-900/20">
              <div className="flex items-center gap-2 text-sm">
                <FileText size={16} className="text-blue-600 dark:text-blue-400" />
                <span className="font-medium">Currently generating:</span>
              </div>
              
              {currentlyGenerating.chapterTitle && (
                <p className="text-sm mt-1 text-muted-foreground">
                  <span className="font-medium">Chapter {currentlyGenerating.chapterIndex !== undefined ? currentlyGenerating.chapterIndex + 1 : ''}:</span> {currentlyGenerating.chapterTitle}
                </p>
              )}
              
              {currentlyGenerating.sectionTitle && (
                <p className="text-sm mt-1 text-muted-foreground">
                  <span className="font-medium">Section {currentlyGenerating.sectionIndex !== undefined ? currentlyGenerating.sectionIndex + 1 : ''}:</span> {currentlyGenerating.sectionTitle}
                </p>
              )}
              
              {estimatedTimeRemaining !== undefined && (
                <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                  <Clock size={12} />
                  <span>{formatTimeRemaining()}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      
      <p className={`${error ? 'text-red-500' : 'text-textbook-accent'} mb-4`}>
        {error ? 'There was an error generating your textbook. Please try again.' : 'Please wait while we create your textbook'}
        <span className={`${!error && 'loading-dots'}`}></span>
      </p>
      
      {!error && onSkipWaiting && completionPercentage > 0 && (
        <button 
          onClick={onSkipWaiting}
          className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline mt-2"
        >
          View partial textbook now
        </button>
      )}
    </div>
  );
};

export default TextbookLoading;
