
import { useState, useEffect } from "react";
import { Textbook } from "@/types/textbook";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export const useTextbookGeneration = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [textbook, setTextbook] = useState<Textbook | null>(null);
  const [currentTextbookId, setCurrentTextbookId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [completionPercentage, setCompletionPercentage] = useState(0);
  const [currentlyGenerating, setCurrentlyGenerating] = useState<Textbook['currentlyGenerating']>(undefined);
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState<number | undefined>(undefined);
  const [skipWaiting, setSkipWaiting] = useState(false);
  const { toast } = useToast();

  // Helper to estimate remaining time based on completion percentage and elapsed time
  const calculateEstimatedTimeRemaining = (startTime: number, completionPercentage: number) => {
    if (completionPercentage <= 0) return undefined;
    
    const elapsedTime = (Date.now() - startTime) / 1000; // in seconds
    const estimatedTotalTime = elapsedTime / (completionPercentage / 100);
    const remainingTime = estimatedTotalTime - elapsedTime;
    
    return Math.max(0, Math.round(remainingTime));
  };

  useEffect(() => {
    if (!currentTextbookId) return;
    
    const generationStartTime = Date.now();
    console.log('Setting up realtime subscription for textbook:', currentTextbookId);
    
    // Subscribe to textbook changes to get status and completion percentage updates
    const textbookChannel = supabase
      .channel('textbook-status')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'textbooks',
          filter: `id=eq.${currentTextbookId}`,
        },
        async (payload) => {
          try {
            console.log('Textbook update received:', payload);
            
            // Update completion percentage - add type checking
            if (payload.new && typeof payload.new === 'object' && 'completion_percentage' in payload.new) {
              const newCompletionPercentage = payload.new.completion_percentage as number;
              setCompletionPercentage(newCompletionPercentage);
              
              // Update estimated time remaining
              if (newCompletionPercentage > 0) {
                setEstimatedTimeRemaining(
                  calculateEstimatedTimeRemaining(generationStartTime, newCompletionPercentage)
                );
              }
            }
            
            // Check if generation is now complete
            if (payload.new && typeof payload.new === 'object' && 'status' in payload.new) {
              const status = payload.new.status as 'generating' | 'completed' | 'error';
              
              if (status === 'completed') {
                // Fetch the complete textbook
                await fetchFullTextbook(currentTextbookId);
              } else if (status === 'error') {
                setHasError(true);
                setIsGenerating(false);
                toast({
                  title: "Error",
                  description: "There was an error generating your textbook.",
                  variant: "destructive",
                });
              }
            }
          } catch (error) {
            console.error('Error handling textbook update:', error);
          }
        }
      )
      .subscribe();
    
    // Subscribe to sections to build the textbook incrementally and track progress
    const sectionsChannel = supabase
      .channel('textbook-sections')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'sections',
        },
        async (payload) => {
          try {
            console.log('New section inserted:', payload);
            
            // Get the chapter this section belongs to
            const { data: sectionData } = await supabase
              .from('sections')
              .select('title, position, chapter_id')
              .eq('id', payload.new.id)
              .single();
              
            if (sectionData && sectionData.chapter_id) {
              const { data: chapterData } = await supabase
                .from('chapters')
                .select('title, position, textbook_id')
                .eq('id', sectionData.chapter_id)
                .single();
                
              if (chapterData && chapterData.textbook_id === currentTextbookId) {
                // Update currently generating info
                setCurrentlyGenerating({
                  chapterIndex: chapterData.position,
                  sectionIndex: sectionData.position,
                  chapterTitle: chapterData.title,
                  sectionTitle: sectionData.title
                });
                
                // Fetch the latest textbook data with any new sections
                await fetchPartialTextbook(currentTextbookId);
              }
            }
            
          } catch (error) {
            console.error('Error handling section insert:', error);
          }
        }
      )
      .subscribe();

    // Initial fetch to get the current state
    fetchPartialTextbook(currentTextbookId);
    
    // Set a timeout for generation
    const timeout = setTimeout(() => {
      if (isGenerating) {
        // When we time out, don't set error - just check if there's a partial textbook
        setIsGenerating(false);
        
        // Try to fetch the textbook even if generation timed out
        fetchPartialTextbook(currentTextbookId);
        
        toast({
          title: 'Generation taking longer than expected',
          description: 'You can view what has been generated so far or wait for completion in your history.',
          variant: 'default',
        });
      }
    }, 90000);

    return () => {
      clearTimeout(timeout);
      supabase.removeChannel(textbookChannel);
      supabase.removeChannel(sectionsChannel);
    };
  }, [currentTextbookId, toast, isGenerating]);

  // Fetch partial textbook data - gets whatever content is available so far
  const fetchPartialTextbook = async (textbookId: string) => {
    try {
      const { data: textbookData, error: textbookError } = await supabase
        .from('textbooks')
        .select(`
          *,
          chapters:chapters(
            *,
            sections:sections(*)
          )
        `)
        .eq('id', textbookId)
        .single();

      if (textbookError || !textbookData) {
        console.error('Error fetching textbook:', textbookError);
        return;
      }

      setCompletionPercentage(textbookData.completion_percentage || 0);
      
      // If the textbook is completed, stop generating
      if (textbookData.status === 'completed') {
        setIsGenerating(false);
        toast({
          title: "Textbook Generated",
          description: "Your textbook is now ready to view.",
        });
      }
      
      // If we have any chapters with content, show what we have
      if (textbookData.chapters && textbookData.chapters.some(chapter => 
        chapter.sections && chapter.sections.length > 0)) {
        
        const formattedTextbook: Textbook = {
          title: textbookData.title,
          description: textbookData.description,
          completionPercentage: textbookData.completion_percentage,
          status: textbookData.status as 'generating' | 'completed' | 'error',
          currentlyGenerating: currentlyGenerating,
          estimatedTimeRemaining: estimatedTimeRemaining,
          chapters: textbookData.chapters.map((chapter: any) => ({
            title: chapter.title,
            sections: (chapter.sections || []).map((section: any) => ({
              title: section.title,
              content: section.content || "Content still generating...",
              isGenerating: !section.content
            })),
            isGenerating: !(chapter.sections && chapter.sections.length > 0)
          })),
        };
        
        setTextbook(formattedTextbook);
        
        // If user chose to skip waiting and we have some content, show the partial textbook
        if (skipWaiting && formattedTextbook.chapters.some(chapter => 
          chapter.sections && chapter.sections.some(section => section.content !== "Content still generating..."))) {
          setIsGenerating(false);
        }
      }
    } catch (error) {
      console.error('Error fetching partial textbook:', error);
    }
  };

  // Fetch the full textbook when generation is complete
  const fetchFullTextbook = async (textbookId: string) => {
    try {
      const { data: textbookData, error: textbookError } = await supabase
        .from('textbooks')
        .select(`
          *,
          chapters:chapters(
            *,
            sections:sections(*)
          )
        `)
        .eq('id', textbookId)
        .single();

      if (textbookError) {
        console.error('Error fetching completed textbook:', textbookError);
        return;
      }

      if (!textbookData || !textbookData.chapters) return;

      const formattedTextbook: Textbook = {
        title: textbookData.title,
        description: textbookData.description,
        completionPercentage: 100,
        status: 'completed',
        chapters: textbookData.chapters.map((chapter: any) => ({
          title: chapter.title,
          sections: (chapter.sections || []).map((section: any) => ({
            title: section.title,
            content: section.content,
            isGenerating: false
          })),
          isGenerating: false
        })),
      };

      setTextbook(formattedTextbook);
      setIsGenerating(false);
      setCurrentlyGenerating(undefined);
      
      toast({
        title: "Textbook Generation Complete",
        description: "Your textbook is now ready to view.",
      });
    } catch (error) {
      console.error('Error in fetchFullTextbook:', error);
    }
  };

  const handlePromptSubmit = async (prompt: string, chapterCount: number = 3) => {
    if (!prompt) {
      setIsGenerating(false);
      setCurrentTextbookId(null);
      setHasError(false);
      return;
    }
    
    if (isSubmitting) {
      console.log('Already submitting, ignoring duplicate request');
      return;
    }
    
    setIsSubmitting(true);
    setIsGenerating(true);
    setTextbook(null);
    setHasError(false);
    setCompletionPercentage(0);
    setSkipWaiting(false);
    setCurrentlyGenerating(undefined);
    setEstimatedTimeRemaining(undefined);
    
    try {
      console.log('Calling generate-textbook function with prompt:', prompt, 'chapter count:', chapterCount);
      const { data: genData, error: genError } = await supabase.functions.invoke('generate-textbook', {
        body: { prompt, chapterCount },
      });

      if (genError) {
        console.error('Error calling Edge Function:', genError);
        throw genError;
      }

      console.log('Generation started with data:', genData);

      if (!genData || !genData.textbookId) {
        throw new Error('No textbook ID returned from the function');
      }

      setCurrentTextbookId(genData.textbookId);

    } catch (error) {
      console.error('Error:', error);
      toast({
        title: 'Error generating textbook',
        description: 'There was an issue creating your textbook. Please try again.',
        variant: 'destructive',
      });
      setIsGenerating(false);
      setCurrentTextbookId(null);
      setHasError(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkipWaiting = () => {
    setSkipWaiting(true);
    // Only set isGenerating to false if we actually have some content
    if (textbook && textbook.chapters.some(chapter => chapter.sections.some(section => !section.isGenerating))) {
      setIsGenerating(false);
    }
  };

  const loadExistingTextbook = (textbookData: Textbook) => {
    setTextbook(textbookData);
  };

  const resetTextbook = () => {
    setTextbook(null);
    setCurrentTextbookId(null);
    setHasError(false);
    setCompletionPercentage(0);
    setSkipWaiting(false);
    setCurrentlyGenerating(undefined);
    setEstimatedTimeRemaining(undefined);
  };

  return {
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
    handleSkipWaiting,
  };
};
