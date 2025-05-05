
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Textbook } from "@/types/textbook";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { BookOpen, Clock, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { Progress } from "@/components/ui/progress";

interface TextbookHistoryProps {
  onSelectTextbook: (textbook: Textbook) => void;
}

const TextbookHistory = ({ onSelectTextbook }: TextbookHistoryProps) => {
  const [textbooks, setTextbooks] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchTextbooks = async () => {
      try {
        setIsLoading(true);
        const { data, error } = await supabase
          .from('textbooks')
          .select(`
            *,
            chapters:chapters(
              *,
              sections:sections(*)
            )
          `)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching textbooks:', error);
          toast({
            title: 'Error',
            description: 'Failed to load textbook history',
            variant: 'destructive',
          });
          return;
        }

        setTextbooks(data || []);
      } catch (error) {
        console.error('Error in fetchTextbooks:', error);
        toast({
          title: 'Error',
          description: 'An unexpected error occurred',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchTextbooks();
    
    // Set up real-time subscription for textbook updates
    const channel = supabase
      .channel('textbooks-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'textbooks',
        },
        () => {
          // Refresh the textbook list when any textbook changes
          fetchTextbooks();
        }
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [toast]);

  const handleSelectTextbook = (textbookData: any) => {
    // Convert from database format to application format
    if (!textbookData.chapters) {
      toast({
        title: 'Incomplete textbook',
        description: 'This textbook does not have any content yet',
        variant: 'destructive',
      });
      return;
    }

    const formattedTextbook: Textbook = {
      title: textbookData.title,
      description: textbookData.description,
      status: textbookData.status,
      completionPercentage: textbookData.completion_percentage,
      chapters: textbookData.chapters.map((chapter: any) => ({
        title: chapter.title,
        sections: (chapter.sections || []).map((section: any) => ({
          title: section.title,
          content: section.content,
        })),
      })),
    };

    onSelectTextbook(formattedTextbook);
  };

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
        <p className="text-muted-foreground">Loading your textbooks...</p>
      </div>
    );
  }

  if (textbooks.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">You haven't created any textbooks yet.</p>
      </div>
    );
  }

  const getStatusIcon = (status: string, percentage: number) => {
    if (status === 'error') return <AlertCircle className="h-4 w-4 text-red-500" />;
    if (status === 'completed' || percentage === 100) return <BookOpen className="h-4 w-4 text-green-500" />;
    return <Clock className="h-4 w-4 text-amber-500" />;
  };

  const getStatusText = (status: string, percentage: number) => {
    if (status === 'error') return "Error";
    if (status === 'completed' || percentage === 100) return "Complete";
    return ""; // Removed text for generating status
  };

  return (
    <div className="mt-8">
      <h2 className="text-xl font-serif font-semibold mb-4">Your Textbooks</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {textbooks.map((textbook) => (
          <Card key={textbook.id} className="overflow-hidden hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-serif">{textbook.title}</CardTitle>
              <CardDescription className="flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" /> 
                  {format(new Date(textbook.created_at), 'MMM d, yyyy')}
                </span>
                <span className="flex items-center gap-1 font-medium" title={getStatusText(textbook.status, textbook.completion_percentage)}>
                  {getStatusIcon(textbook.status, textbook.completion_percentage)}
                  <span className="text-xs">
                    {getStatusText(textbook.status, textbook.completion_percentage)}
                  </span>
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent className="pb-3">
              <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                {textbook.description || "No description provided"}
              </p>
              
              {textbook.status === 'generating' && textbook.completion_percentage > 0 && (
                <Progress value={textbook.completion_percentage || 0} className="h-1" />
              )}
            </CardContent>
            <CardFooter>
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full" 
                onClick={() => handleSelectTextbook(textbook)}
                disabled={!textbook.chapters || textbook.chapters.length === 0}
              >
                <BookOpen className="mr-2 h-4 w-4" /> 
                {textbook.status === 'generating' ? 'View Progress' : 'View Textbook'}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default TextbookHistory;
