
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Send } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface TextbookPromptProps {
  onSubmit: (prompt: string, chapterCount: number) => void;
  isLoading: boolean;
}

const TextbookPrompt: React.FC<TextbookPromptProps> = ({ onSubmit, isLoading }) => {
  const [prompt, setPrompt] = useState('');
  const [chapterCount, setChapterCount] = useState(3);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (prompt.trim().length < 10) {
      toast({
        title: 'Prompt too short',
        description: 'Please provide a more detailed description for better results.',
        variant: 'destructive',
      });
      return;
    }
    
    if (isSubmitting || isLoading) {
      console.log('Already submitting, ignoring duplicate request');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      onSubmit(prompt.trim(), chapterCount);
    } catch (error) {
      console.error('Error generating textbook:', error);
      toast({
        title: 'Error generating textbook',
        description: 'There was an error generating your textbook. Please try again.',
        variant: 'destructive',
      });
      // Reset the loading state in case of error
      onSubmit('', chapterCount);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex gap-4 items-center mb-4">
          <label className="text-sm font-medium">
            Number of Chapters:
          </label>
          <Input
            type="number"
            min={1}
            max={10}
            value={chapterCount}
            onChange={(e) => setChapterCount(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
            className="w-24"
            disabled={isLoading || isSubmitting}
          />
        </div>
        <div className="relative">
          <Textarea
            placeholder="Describe the textbook you want to generate (e.g., 'Create a comprehensive introduction to machine learning for undergraduate computer science students')"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="min-h-32 pr-12 text-base resize-none rounded-3xl border-2 border-white/20 dark:border-white/10 shadow-sm focus:border-indigo-400 dark:focus:border-purple-400 transition-all duration-300"
            disabled={isLoading || isSubmitting}
          />
          <Button 
            type="submit" 
            size="icon" 
            className="absolute bottom-3 right-3 rounded-full"
            disabled={isLoading || isSubmitting || prompt.trim().length === 0}
          >
            <Send className="h-5 w-5" />
          </Button>
        </div>
      </form>
    </div>
  );
};

export default TextbookPrompt;
