
import TextbookPrompt from "@/components/TextbookPrompt";

interface WelcomePromptProps {
  onSubmit: (prompt: string, chapterCount: number) => void;
  isLoading: boolean;
}

const WelcomePrompt = ({ onSubmit, isLoading }: WelcomePromptProps) => {
  return (
    <>
      <div className="text-center mb-10">
        <h2 className="text-3xl font-serif font-semibold mb-4 bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 bg-clip-text text-transparent">
          What textbook do you want to create?
        </h2>
        <p className="text-gray-600 dark:text-gray-300 max-w-xl mx-auto mb-6 leading-relaxed">
          Describe the subject, intended audience, and any specific topics you want covered.
          Choose the number of chapters you need (1-10).
        </p>
      </div>
      <TextbookPrompt onSubmit={onSubmit} isLoading={isLoading} />
    </>
  );
};

export default WelcomePrompt;
