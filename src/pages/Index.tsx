
import TextbookDisplay from "@/components/TextbookDisplay";
import TextbookLoading from "@/components/TextbookLoading";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import WelcomePrompt from "@/components/WelcomePrompt";
import { useTextbookGeneration } from "@/hooks/useTextbookGeneration";
import TextbookHistory from "@/components/TextbookHistory";
import { useState } from "react";

const Index = () => {
  const {
    isGenerating,
    textbook,
    hasError,
    handlePromptSubmit,
    resetTextbook,
    isSubmitting,
    loadExistingTextbook,
    completionPercentage,
    currentlyGenerating,
    estimatedTimeRemaining,
    handleSkipWaiting
  } = useTextbookGeneration();
  
  const [showHistory, setShowHistory] = useState(false);

  const handleRetry = () => {
    resetTextbook();
  };
  
  const handleToggleHistory = () => {
    setShowHistory(prev => !prev);
  };

  return <div className="min-h-screen flex flex-col bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800">
      <Header />

      <main className="flex-grow container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {!textbook && !isGenerating && <div className="backdrop-blur-lg bg-white/30 dark:bg-gray-900/30 rounded-2xl border border-white/20 dark:border-white/10 p-8 shadow-xl">
              <WelcomePrompt onSubmit={handlePromptSubmit} isLoading={isGenerating || isSubmitting} />
              
              {!isSubmitting && <>
                  <div className="flex justify-center mt-8">
                    <Button variant="outline" onClick={handleToggleHistory} className="mx-auto bg-white/50 dark:bg-gray-800/50 hover:bg-white/70 dark:hover:bg-gray-700/50 transition-all duration-300 font-normal rounded-full">
                      {showHistory ? "Hide Textbook History" : "Show Textbook History"}
                    </Button>
                  </div>
                  
                  {showHistory && <div className="mt-8 backdrop-blur-sm bg-white/20 dark:bg-gray-800/20 rounded-xl p-6">
                      <TextbookHistory onSelectTextbook={loadExistingTextbook} />
                    </div>}
                </>}
            </div>}

          {isGenerating && <div className="backdrop-blur-lg bg-white/30 dark:bg-gray-900/30 rounded-2xl border border-white/20 dark:border-white/10 p-8 shadow-xl">
              <TextbookLoading 
                error={hasError} 
                completionPercentage={completionPercentage} 
                currentlyGenerating={currentlyGenerating}
                estimatedTimeRemaining={estimatedTimeRemaining}
                onSkipWaiting={handleSkipWaiting}
              />
              {hasError && <div className="flex justify-center mt-6">
                  <Button onClick={handleRetry} className="flex items-center gap-2 bg-white/50 dark:bg-gray-800/50 hover:bg-white/70 dark:hover:bg-gray-700/50">
                    <RefreshCw size={16} />
                    Try Again
                  </Button>
                </div>}
            </div>}

          {textbook && !isGenerating && <div className="backdrop-blur-lg bg-white/30 dark:bg-gray-900/30 rounded-2xl border border-white/20 dark:border-white/10 p-8 shadow-xl">
              <TextbookDisplay textbook={textbook} onReset={resetTextbook} />
            </div>}
        </div>
      </main>

      <Footer />
    </div>;
};

export default Index;
